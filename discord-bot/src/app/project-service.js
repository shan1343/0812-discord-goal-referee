import { rm } from "node:fs/promises";
import path from "node:path";
import { projectKey, nowIso } from "../contracts.js";
import { assignProject } from "../rules/assignment.js";
import { computeProgress } from "../rules/progress.js";
import { createProjectPackage } from "../packaging/create-package.js";

function userSource({ guildId, channelId, userId, timestamp }) {
  return `discord-user-input#${guildId}/${channelId}/${userId}/${timestamp}`;
}

function uniqueBy(items, key) {
  return [...new Map(items.map((item) => [item[key], item])).values()];
}

function parseDoneConditions(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function actorId(actor) {
  return typeof actor === "string" ? actor : actor?.id;
}

function assertActorMatches(actor, claimedId) {
  const id = actorId(actor);
  if (claimedId && id !== claimedId) throw new Error("요청 사용자와 기록 사용자가 일치하지 않습니다.");
  return id;
}

export function assertOwnerOrAdmin(project, actor) {
  const id = actorId(actor);
  if (!id) throw new Error("이 작업을 수행할 사용자를 확인할 수 없습니다.");
  if (id !== project.createdBy && actor?.canManageGuild !== true) {
    throw new Error("프로젝트 생성자 또는 서버 관리자만 이 작업을 할 수 있습니다.");
  }
}

export function assertTeamActor(project, actor) {
  const id = actorId(actor);
  if (!id) throw new Error("이 작업을 수행할 사용자를 확인할 수 없습니다.");
  const isMember = (project.members || []).some((member) => member.id === id);
  if (id !== project.createdBy && !isMember && actor?.canManageGuild !== true) {
    throw new Error("프로젝트 생성자, 등록 팀원 또는 서버 관리자만 변경할 수 있습니다.");
  }
}

export class ProjectService {
  constructor({ store, extractor, config, clock = () => new Date() }) {
    this.store = store;
    this.extractor = extractor;
    this.config = config;
    this.clock = clock;
    this.packageSequence = 0;
  }

  key(guildId, channelId) {
    return projectKey(guildId, channelId);
  }

  async getProject(guildId, channelId) {
    return this.store.get(this.key(guildId, channelId));
  }

  async requireProject(guildId, channelId) {
    const project = await this.getProject(guildId, channelId);
    if (!project) throw new Error("이 채널에는 아직 프로젝트가 없습니다. /project create를 먼저 실행해 주세요.");
    return project;
  }

  async assertTaskAccess({ guildId, channelId, taskId, actor }) {
    const project = await this.requireProject(guildId, channelId);
    assertTeamActor(project, actor);
    if (!project.tasks.some((task) => task.id === taskId)) throw new Error("Task를 찾을 수 없습니다.");
    return project;
  }

  async configureLiveChat({ guildId, channelId, enabled, mode = "mention", prefix = "!gpt", historyLimit = 8, actor }) {
    const snapshot = await this.requireProject(guildId, channelId);
    assertOwnerOrAdmin(snapshot, actor);
    const allowedModes = new Set(["mention", "prefix", "all"]);
    if (!allowedModes.has(mode)) throw new Error("지원하지 않는 실시간 채팅 모드입니다.");
    const boundedLimit = Math.min(Math.max(Number(historyLimit) || 8, 1), this.config.liveChat?.maxHistory || 20);
    if (mode === "prefix" && !String(prefix || "").trim()) throw new Error("prefix 모드에는 호출 문자가 필요합니다.");
    return this.store.update(this.key(guildId, channelId), (project) => {
      assertOwnerOrAdmin(project, actor);
      return {
        ...project,
        liveChat: {
          enabled: Boolean(enabled),
          mode,
          trigger: mode,
          prefix: String(prefix || "!gpt").trim().slice(0, 20),
          historyLimit: boundedLimit,
          historyEnabled: true,
          cooldownMs: this.config.liveChat?.cooldownMs || 0,
          showTrace: this.config.liveChat?.showDiagnostics !== false,
          updatedAt: nowIso(this.clock),
          updatedBy: actorId(actor),
        },
        liveChatTurns: enabled ? project.liveChatTurns || [] : [],
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async getLiveChatStatus(guildId, channelId) {
    const project = await this.requireProject(guildId, channelId);
    return {
      projectId: project.id,
      ...(project.liveChat || { enabled: false, mode: "mention", prefix: "!gpt", historyLimit: 8 }),
      storedTurns: (project.liveChatTurns || []).length,
      aiMode: this.config.ai.mode,
      model: this.config.ai.model,
      messageContentIntent: this.config.discord.enableMessageContent,
    };
  }

  async recordLiveChatTurn({ guildId, channelId, userTurn, assistantTurn, diagnostics }) {
    const snapshot = await this.requireProject(guildId, channelId);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project.liveChat?.enabled) throw new Error("이 채널의 실시간 GPT 연결이 꺼져 있습니다.");
      const historyLimit = project.liveChat.historyLimit || 8;
      const turns = [
        ...(project.liveChatTurns || []),
        {
          id: userTurn.id,
          role: "user",
          authorId: userTurn.authorId,
          authorName: userTurn.authorName,
          content: userTurn.content,
          occurredAt: userTurn.occurredAt,
          source: userTurn.source,
        },
        {
          id: assistantTurn.id,
          role: "assistant",
          content: assistantTurn.content,
          occurredAt: assistantTurn.occurredAt,
          source: assistantTurn.source,
          diagnostics: {
            responseId: diagnostics?.responseId || null,
            model: diagnostics?.model || this.config.ai.model,
            inputTokens: diagnostics?.usage?.inputTokens ?? null,
            outputTokens: diagnostics?.usage?.outputTokens ?? null,
            latencyMs: diagnostics?.latencyMs ?? null,
          },
        },
      ].slice(-(historyLimit * 2));
      return { ...project, liveChatTurns: turns };
    });
  }

  async createProject({ guildId, channelId, createdBy, name = null, goal, deadline = null, doneState = null }) {
    if (!guildId) throw new Error("개인 메시지에서는 프로젝트를 만들 수 없습니다.");
    const key = this.key(guildId, channelId);
    const timestamp = nowIso(this.clock);
    const project = {
      id: `TR-${channelId}`,
      name: String(name || goal || "").trim().slice(0, 100),
      guildId,
      channelId,
      goal: {
        title: String(goal || "").trim(),
        deadline: deadline || null,
        doneState: doneState || null,
        source: userSource({ guildId, channelId, userId: createdBy, timestamp }),
      },
      members: [],
      tasks: [],
      evidence: [],
      assignments: [],
      assignmentState: "needs_input",
      checkpointEvidence: [],
      approvals: [],
      artifacts: [],
      blockers: [],
      revision: 1,
      createdBy,
    };
    if (!project.goal.title) throw new Error("Goal을 입력해 주세요.");
    try {
      return await this.store.create(key, project);
    } catch (error) {
      if (String(error.message).includes("already exists")) {
        throw new Error("이 채널에는 이미 프로젝트가 있습니다.");
      }
      throw error;
    }
  }

  async setMembers({ guildId, channelId, members, changedBy, actor }) {
    assertActorMatches(actor, changedBy);
    assertOwnerOrAdmin(await this.requireProject(guildId, channelId), actor);
    const normalized = uniqueBy(
      (members || [])
        .filter((member) => member?.id && !member.bot)
        .map((member) => ({
          id: String(member.id),
          displayName: String(member.displayName || member.username || member.id),
        })),
      "id",
    );
    if (!normalized.length) throw new Error("팀원을 한 명 이상 선택해 주세요.");
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertOwnerOrAdmin(project, actor);
      const sameRoster = project.members.length === normalized.length
        && project.members.every((member, index) => member.id === normalized[index].id
          && member.displayName === normalized[index].displayName);
      if (sameRoster) return project;
      const memberIds = new Set(normalized.map((member) => member.id));
      const lockedRemoved = project.tasks.filter((task) => task.lockedOwnerId && !memberIds.has(task.lockedOwnerId));
      if (lockedRemoved.length) {
        throw new Error(`고정 담당 Task(${lockedRemoved.map((task) => task.id).join(", ")})를 먼저 다른 팀원에게 배정해 주세요.`);
      }
      return {
        ...project,
        members: normalized,
        assignments: [],
        assignmentState: "needs_input",
        revision: (project.revision || 0) + 1,
        lastChangeSource: userSource({ guildId, channelId, userId: changedBy, timestamp }),
      };
    });
  }

  async addTask({
    guildId,
    channelId,
    title,
    weight = 1,
    doneConditions,
    requiredFile = null,
    requiredFiles = [],
    skills = [],
    deadline = null,
    lockedOwnerId = null,
    dependencyIds = [],
    createdBy,
    actor,
  }) {
    assertActorMatches(actor, createdBy);
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      const taskId = `T-${String(project.tasks.length + 1).padStart(2, "0")}`;
      const conditions = parseDoneConditions(doneConditions);
      if (!conditions.length) conditions.push("담당자가 완료조건 충족을 확인");
      const checkpointSpecs = conditions.map((condition) => ({ title: condition, evidenceKind: "confirmation" }));
      const files = [...new Set([requiredFile, ...(requiredFiles || [])].filter(Boolean))];
      for (const file of files) {
        checkpointSpecs.push({ title: `필수 파일: ${file}`, evidenceKind: "artifact", requiredFile: file });
      }
      const checkpoints = checkpointSpecs.map((checkpoint, index) => ({
        id: `${taskId}-C${index + 1}`,
        title: checkpoint.title,
        weight: Number((1 / checkpointSpecs.length).toFixed(6)),
        required: true,
        evidenceKind: checkpoint.evidenceKind,
        requiredFile: checkpoint.requiredFile || null,
      }));
      const task = {
        id: taskId,
        title: String(title || "").trim(),
        text: String(title || "").trim(),
        skills: Array.isArray(skills) ? skills : String(skills || "").split(",").map((item) => item.trim()).filter(Boolean),
        deadline,
        weight: Math.max(Number(weight) || 1, 0.01),
        lockedOwnerId: lockedOwnerId || null,
        dependencyIds: [...new Set(dependencyIds || [])],
        checkpoints,
        blockers: [],
        source: userSource({ guildId, channelId, userId: createdBy, timestamp }),
      };
      if (!task.title) throw new Error("Task 이름을 입력해 주세요.");
      return {
        ...project,
        tasks: [...project.tasks, task],
        assignments: [],
        assignmentState: "needs_input",
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async updateTask({
    guildId,
    channelId,
    taskId,
    text,
    ownerId,
    state,
    blocker,
    nextAction,
    deadline,
    changedBy,
    actor,
  }) {
    assertActorMatches(actor, changedBy);
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      const existing = project.tasks.find((item) => item.id === taskId);
      if (!existing) throw new Error("Task를 찾을 수 없습니다.");
      if (ownerId && !project.members.some((member) => member.id === ownerId)) {
        throw new Error("프로젝트에 등록된 팀원만 담당자로 지정할 수 있습니다.");
      }
      const source = userSource({ guildId, channelId, userId: changedBy, timestamp });
      const tasks = project.tasks.map((task) => task.id === taskId
        ? {
            ...task,
            ...(text ? { title: text, text } : {}),
            ...(ownerId ? { lockedOwnerId: ownerId } : {}),
            ...(state ? { manualState: state, stateSource: source } : {}),
            ...(deadline ? { deadline } : {}),
            ...(nextAction ? { nextAction, nextActionSource: source } : {}),
            blockers: blocker ? [{ text: blocker, source }] : state && state !== "blocked" ? [] : task.blockers,
          }
        : task);
      let checkpointEvidence = project.checkpointEvidence || [];
      if (state === "done") {
        const confirmations = existing.checkpoints
          .filter((checkpoint) => checkpoint.evidenceKind !== "artifact")
          .map((checkpoint) => ({
            id: `AUTO-CHK-${taskId}-${checkpoint.id}`,
            taskId,
            checkpointId: checkpoint.id,
            note: "사용자가 완료를 확인함",
            generatedBy: "task-state-done",
            occurredAt: timestamp,
            source,
          }));
        checkpointEvidence = uniqueBy([...checkpointEvidence, ...confirmations], "id");
      } else if (state) {
        const automaticIds = new Set(existing.checkpoints
          .filter((checkpoint) => checkpoint.evidenceKind !== "artifact")
          .map((checkpoint) => `AUTO-CHK-${taskId}-${checkpoint.id}`));
        checkpointEvidence = checkpointEvidence.filter((item) => !automaticIds.has(item.id));
      }
      const assignments = ownerId
        ? uniqueBy([
            ...(project.assignments || []).filter((item) => (item.taskId || item.task_id) !== taskId),
            {
              taskId,
              ownerId,
              reason: "사용자가 담당자를 직접 지정함",
              evidenceIds: [source],
              confidence: "high",
              blockers: [],
              alternativeOwnerId: null,
              status: "confirmed",
              source,
            },
          ], "taskId")
        : project.assignments;
      return {
        ...project,
        tasks,
        assignments,
        checkpointEvidence,
        assignmentState: ownerId ? "needs_input" : project.assignmentState,
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async captureEvidence({ guildId, channelId, event, actor }) {
    if (!event) throw new Error("수집할 수 없는 메시지입니다.");
    const project = await this.requireProject(guildId, channelId);
    assertTeamActor(project, actor);
    const latest = await this.requireProject(guildId, channelId);
    assertTeamActor(latest, actor);
    await this.store.addEvidence(this.key(guildId, channelId), event);
    return {
      project: await this.getProject(guildId, channelId),
      added: !(project.evidence || []).some((item) => item.id === event.id),
    };
  }

  async proposeAssignments({ guildId, channelId, taskId = null, note = null, requestedBy = null, actor }) {
    assertActorMatches(actor, requestedBy);
    const project = await this.requireProject(guildId, channelId);
    assertTeamActor(project, actor);
    if (!project.members.length) throw new Error("먼저 /project members로 팀원을 등록해 주세요.");
    if (!project.tasks.length) throw new Error("먼저 /task add로 Task를 등록해 주세요.");
    if (taskId && !project.tasks.some((task) => task.id === taskId)) {
      throw new Error("배정할 Task를 찾을 수 없습니다.");
    }
    const timestamp = nowIso(this.clock);
    const noteEvidence = note ? {
      id: `INPUT-${project.revision + 1}`,
      projectId: project.id,
      source_type: "user_input",
      occurred_at: timestamp,
      actor: null,
      text: note,
      source: userSource({ guildId, channelId, userId: requestedBy || project.createdBy, timestamp }),
      metadata: { guild_id: guildId, channel_id: channelId, author_id: requestedBy || null },
    } : null;
    const effectiveEvidence = noteEvidence ? [...(project.evidence || []), noteEvidence] : project.evidence || [];
    const scopedProject = taskId
      ? { ...project, tasks: project.tasks.filter((task) => task.id === taskId) }
      : project;
    const result = await assignProject({
      extractor: this.extractor,
      project: scopedProject,
      messages: effectiveEvidence,
    });
    return this.store.update(this.key(guildId, channelId), (current) => {
      if (current.revision !== project.revision) {
        throw new Error("배정 중 프로젝트가 변경되었습니다. 다시 실행해 주세요.");
      }
      assertTeamActor(current, actor);
      const assignments = taskId
        ? uniqueBy([
            ...(current.assignments || []).filter((item) => (item.taskId || item.task_id) !== taskId),
            ...(result.assignments || []),
          ], "taskId")
        : result.assignments || [];
      const unassigned = taskId
        ? [...new Set([...(current.unassigned || []).filter((id) => id !== taskId), ...(result.unassigned || [])])]
        : result.unassigned || [];
      const covered = new Set(assignments.map((item) => item.taskId || item.task_id));
      const assignmentState = assignments.some((item) => item.status === "needs_input" || !(item.ownerId || item.owner_id))
          || current.tasks.some((task) => !covered.has(task.id))
        ? "needs_input"
        : "proposed";
      return {
        ...current,
        evidence: noteEvidence ? uniqueBy([...(current.evidence || []), noteEvidence], "id") : current.evidence,
        assignments,
        unassigned,
        questions: result.questions || [],
        assignmentWarnings: result.warnings || [],
        assignmentState,
        revision: (current.revision || 0) + 1,
      };
    });
  }

  async confirmAssignments({ guildId, channelId, revision, confirmedBy, actor }) {
    assertActorMatches(actor, confirmedBy);
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      if (revision != null && Number(revision) !== Number(project.revision)) {
        throw new Error("더 최신 배정안이 있습니다. 상태를 새로고침해 주세요.");
      }
      if (!(project.assignments || []).length) throw new Error("확정할 배정안이 없습니다.");
      const taskIds = new Set(project.tasks.map((task) => task.id));
      const seen = new Set();
      for (const assignment of project.assignments) {
        const taskId = assignment.taskId || assignment.task_id;
        const ownerId = assignment.ownerId || assignment.owner_id;
        if (!taskIds.has(taskId) || seen.has(taskId)) throw new Error("배정안의 Task 구성이 올바르지 않습니다.");
        if (!project.members.some((member) => member.id === ownerId)) throw new Error("배정안에 등록되지 않은 담당자가 있습니다.");
        seen.add(taskId);
      }
      if (seen.size !== taskIds.size) throw new Error("모든 Task에 담당자가 있어야 확정할 수 있습니다.");
      if (project.assignments.some((item) => !item.ownerId && !item.owner_id)) {
        throw new Error("담당자가 정해지지 않은 Task가 있어 확정할 수 없습니다.");
      }
      const source = userSource({ guildId, channelId, userId: confirmedBy, timestamp });
      return {
        ...project,
        assignments: project.assignments.map((item) => ({ ...item, status: "confirmed", confirmedAt: timestamp, confirmationSource: source })),
        assignmentState: "confirmed",
        confirmedAt: timestamp,
        confirmedBy,
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async recordCheckpoint({ guildId, channelId, taskId, checkpointId, confirmedBy, note = null, actor }) {
    assertActorMatches(actor, confirmedBy);
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      const task = project.tasks.find((item) => item.id === taskId);
      const checkpoint = task?.checkpoints?.find((item) => item.id === checkpointId);
      if (!checkpoint) throw new Error("완료조건을 찾을 수 없습니다.");
      const item = {
        id: `MANUAL-CHK-${taskId}-${checkpointId}-${confirmedBy}`,
        taskId,
        checkpointId,
        note,
        occurredAt: timestamp,
        source: userSource({ guildId, channelId, userId: confirmedBy, timestamp }),
      };
      return {
        ...project,
        checkpointEvidence: uniqueBy([...(project.checkpointEvidence || []), item], "id"),
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async setTaskBlocker({ guildId, channelId, taskId, blocker, changedBy, actor }) {
    assertActorMatches(actor, changedBy);
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    const timestamp = nowIso(this.clock);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      if (!project.tasks.some((task) => task.id === taskId)) throw new Error("Task를 찾을 수 없습니다.");
      const source = userSource({ guildId, channelId, userId: changedBy, timestamp });
      return {
        ...project,
        tasks: project.tasks.map((task) => task.id === taskId
          ? { ...task, blockers: blocker ? [{ text: blocker, source }] : [] }
          : task),
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async addArtifact({ guildId, channelId, artifact, actor }) {
    assertTeamActor(await this.requireProject(guildId, channelId), actor);
    return this.store.update(this.key(guildId, channelId), (project) => {
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      assertTeamActor(project, actor);
      if (!project.tasks.some((task) => task.id === artifact.taskId)) throw new Error("Task를 찾을 수 없습니다.");
      const task = project.tasks.find((item) => item.id === artifact.taskId);
      let checkpoint = task.checkpoints.find((item) => item.evidenceKind === "artifact"
        && (!item.requiredFile || item.requiredFile === artifact.filename));
      let tasks = project.tasks;
      if (artifact.required && !checkpoint) {
        checkpoint = {
          id: `${task.id}-C${task.checkpoints.length + 1}`,
          title: `필수 파일: ${artifact.filename}`,
          weight: 1,
          required: true,
          evidenceKind: "artifact",
          requiredFile: artifact.filename,
          source: artifact.source,
        };
        tasks = project.tasks.map((item) => item.id === task.id
          ? { ...item, checkpoints: [...item.checkpoints, checkpoint] }
          : item);
      }
      return {
        ...project,
        tasks,
        artifacts: uniqueBy([
          ...(project.artifacts || []),
          { ...artifact, checkpointId: artifact.checkpointId || checkpoint?.id || null },
        ], "id"),
        revision: (project.revision || 0) + 1,
      };
    });
  }

  async getProgress({ guildId, channelId }) {
    const project = await this.requireProject(guildId, channelId);
    return computeProgress({
      project,
      checkpointEvidence: project.checkpointEvidence || [],
      artifacts: project.artifacts || [],
      approvals: project.approvals || [],
      previousProgress: project.progress?.taskProgress || [],
    });
  }

  async saveProgress({ guildId, channelId }) {
    const snapshot = await this.requireProject(guildId, channelId);
    const progress = computeProgress({
      project: snapshot,
      checkpointEvidence: snapshot.checkpointEvidence || [],
      artifacts: snapshot.artifacts || [],
      approvals: snapshot.approvals || [],
      previousProgress: snapshot.progress?.taskProgress || [],
    });
    const project = await this.store.update(this.key(guildId, channelId), (current) => {
      if (current.revision !== snapshot.revision) {
        throw new Error("상태 계산 중 프로젝트가 변경되었습니다. 다시 실행해 주세요.");
      }
      return { ...current, progress };
    });
    return { project, progress };
  }

  async createPackage({ guildId, channelId, artifactIds = null, actor }) {
    const project = await this.requireProject(guildId, channelId);
    assertTeamActor(project, actor);
    const progress = computeProgress({
      project,
      checkpointEvidence: project.checkpointEvidence || [],
      artifacts: project.artifacts || [],
      approvals: project.approvals || [],
      previousProgress: project.progress?.taskProgress || [],
    });
    const selectedIds = Array.isArray(artifactIds) && artifactIds.length ? new Set(artifactIds) : null;
    if (selectedIds) {
      const known = new Set((project.artifacts || []).map((artifact) => artifact.id));
      const missing = [...selectedIds].filter((id) => !known.has(id));
      if (missing.length) throw new Error(`등록되지 않은 Artifact: ${missing.join(", ")}`);
    }
    this.packageSequence += 1;
    return createProjectPackage({
      project: {
        ...project,
        progress,
        artifacts: selectedIds
          ? (project.artifacts || []).filter((artifact) => selectedIds.has(artifact.id))
          : project.artifacts,
      },
      outputDir: path.join(
        this.config.storage.artifactDir,
        project.id,
        `r${project.revision}-p${this.packageSequence}`,
      ),
      maxBytes: this.config.storage.maxPackageBytes,
    });
  }

  async deleteProject({ guildId, channelId, actor }) {
    const project = await this.requireProject(guildId, channelId);
    assertOwnerOrAdmin(project, actor);
    const base = path.resolve(this.config.storage.artifactDir);
    const target = path.resolve(base, project.id);
    if (path.dirname(target) !== base || target === base) {
      throw new Error("저장 파일 경로가 안전하지 않아 삭제를 중단했습니다.");
    }
    await rm(target, { recursive: true, force: true });
    return this.store.delete(this.key(guildId, channelId));
  }
}
