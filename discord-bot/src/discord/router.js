import path from "node:path";
import { PermissionFlagsBits } from "discord.js";
import { rm } from "node:fs/promises";
import { normalizeDiscordMessage } from "../etl/discord-event.js";
import { goalRefereeText } from "../ai/goal-referee.js";
import { downloadArtifact } from "../artifacts/registry.js";
import { assignmentView, chatStatusView, chatTestView, errorView, statusView } from "./views.js";

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function projectResult(project) {
  return {
    assignments: project.assignments || [],
    unassigned: project.unassigned || [],
    questions: project.questions || [],
    warnings: project.assignmentWarnings || [],
    evidence: project.evidence || [],
    revision: project.revision,
    mode: project.assignmentMode || "rules",
  };
}

function memberFromUser(user) {
  return user && {
    id: user.id,
    displayName: user.globalName || user.displayName || user.username,
    username: user.username,
    bot: user.bot,
  };
}

function actorFromInteraction(interaction) {
  return {
    id: interaction.user.id,
    canManageGuild: interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild) === true,
  };
}

async function respond(interaction, payload, { edit = false } = {}) {
  if (edit || interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function parseComponentId(customId) {
  const [action, projectId, revisionToken] = String(customId || "").split("|");
  return {
    action,
    projectId,
    revision: revisionToken?.startsWith("r") ? Number(revisionToken.slice(1)) : null,
  };
}

function summaryProject(project) {
  const deadline = project.goal?.deadline ? `\n마감: ${project.goal.deadline}` : "";
  return {
    embeds: [{
      title: project.name || "프로젝트",
      description: `${project.goal?.title || "-"}${deadline}`,
      color: 0x2b6cb0,
      fields: [
        { name: "팀원", value: String(project.members?.length || 0), inline: true },
        { name: "Task", value: String(project.tasks?.length || 0), inline: true },
        { name: "선택한 근거", value: String(project.evidence?.length || 0), inline: true },
      ],
    }],
    allowedMentions: { parse: [] },
    ephemeral: true,
  };
}

export function createInteractionRouter({ service, config, chatResponder, goalReferee, dashboardPublisher, fetchImpl = fetch, logger = console }) {
  async function requireGuild(interaction) {
    if (!interaction.guildId) throw new Error("서버 채널에서만 사용할 수 있습니다.");
    return service.requireProject(interaction.guildId, interaction.channelId);
  }

  async function handleProject(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "create") {
      const project = await service.createProject({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdBy: interaction.user.id,
        name: interaction.options.getString("name", true),
        goal: interaction.options.getString("goal", true),
        deadline: interaction.options.getString("deadline", true),
        doneState: interaction.options.getString("done", true),
      });
      return interaction.editReply(summaryProject(project));
    }
    if (subcommand === "members") {
      const project = await requireGuild(interaction);
      const action = interaction.options.getString("action", true);
      const selected = memberFromUser(interaction.options.getUser("member"));
      if (action === "list") return interaction.editReply(summaryProject(project));
      if (!selected) throw new Error("추가하거나 제외할 팀원을 선택해 주세요.");
      const members = action === "add"
        ? [...project.members, selected]
        : project.members.filter((member) => member.id !== selected.id);
      const updated = await service.setMembers({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        members,
        changedBy: interaction.user.id,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply(summaryProject(updated));
    }
    if (subcommand === "delete") {
      if (!interaction.options.getBoolean("confirm", true)) {
        throw new Error("삭제하려면 confirm을 켜 주세요.");
      }
      await service.deleteProject({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply({ content: "이 채널의 프로젝트 데이터와 저장 파일을 삭제했습니다." });
    }
  }

  async function handleTask(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    await requireGuild(interaction);
    if (subcommand === "add") {
      const files = csv(interaction.options.getString("required_files"));
      const project = await service.addTask({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        title: interaction.options.getString("text", true),
        skills: csv(interaction.options.getString("skills")),
        weight: interaction.options.getNumber("effort") || 1,
        deadline: interaction.options.getString("deadline"),
        requiredFiles: files,
        dependencyIds: csv(interaction.options.getString("dependencies")),
        doneConditions: interaction.options.getString("done_conditions"),
        createdBy: interaction.user.id,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply(summaryProject(project));
    }
    if (subcommand === "update") {
      const owner = interaction.options.getUser("owner");
      const project = await service.updateTask({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        taskId: interaction.options.getString("task", true),
        text: interaction.options.getString("text"),
        ownerId: owner?.id,
        state: interaction.options.getString("state"),
        blocker: interaction.options.getString("blocker"),
        nextAction: interaction.options.getString("next_action"),
        deadline: interaction.options.getString("deadline"),
        changedBy: interaction.user.id,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply(summaryProject(project));
    }
  }

  async function handleAssign(interaction) {
    await interaction.deferReply();
    const project = await service.proposeAssignments({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      taskId: interaction.options.getString("task"),
      note: interaction.options.getString("note"),
      requestedBy: interaction.user.id,
      actor: actorFromInteraction(interaction),
    });
    return interaction.editReply(assignmentView(projectResult(project), project));
  }

  async function handleGoalReferee(interaction) {
    if (!interaction.guildId || !interaction.channel?.messages?.fetch) throw new Error("서버의 텍스트 채널에서만 사용할 수 있습니다.");
    if (!config.discord?.enableMessageContent) throw new Error("Message Content Intent를 켜고 봇을 다시 시작해 주세요.");
    if (!goalReferee) throw new Error("Goal Referee가 초기화되지 않았습니다.");
    await interaction.deferReply();
    const limit = interaction.options.getInteger("messages") || 40;
    const fetched = await interaction.channel.messages.fetch({ limit });
    const messages = [...fetched.values()]
      .filter((message) => !message.author?.bot && message.guildId === interaction.guildId && String(message.content || "").trim())
      .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
      .map((message) => ({
        id: message.id,
        authorId: message.author.id,
        authorName: message.member?.displayName || message.author.globalName || message.author.username,
        createdAt: new Date(message.createdTimestamp).toISOString(),
        content: message.content,
      }));
    const result = await goalReferee.analyze({ guildId: interaction.guildId, channelId: interaction.channelId, messages });
    let dashboardUrl = null;
    if (dashboardPublisher) {
      await dashboardPublisher.publish({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        result,
        sourceMessageCount: messages.length,
      });
      dashboardUrl = dashboardPublisher.dashboardUrl(interaction.channelId);
    }
    return interaction.editReply({
      content: goalRefereeText(result),
      allowedMentions: { parse: [] },
      ...(dashboardUrl ? {
        components: [{
          type: 1,
          components: [{ type: 2, style: 5, label: "웹 대시보드 열기", url: dashboardUrl }],
        }],
      } : {}),
    });
  }

  async function handleStatus(interaction) {
    await interaction.deferReply();
    const { project, progress } = await service.saveProgress({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    const taskId = interaction.options.getString("task");
    const filtered = taskId
      ? { ...progress, taskProgress: progress.taskProgress.filter((item) => item.taskId === taskId) }
      : progress;
    return interaction.editReply(statusView(filtered, project));
  }

  async function handleChat(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    const actor = actorFromInteraction(interaction);
    if (subcommand === "setup") {
      if (!config.discord.enableMessageContent) {
        throw new Error("실시간 채팅을 사용하려면 .env와 Discord Developer Portal에서 Message Content Intent를 켜야 합니다.");
      }
      const project = await service.configureLiveChat({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        enabled: true,
        mode: interaction.options.getString("mode", true),
        prefix: interaction.options.getString("prefix") || "!gpt",
        historyLimit: interaction.options.getInteger("history_limit") || 8,
        actor,
      });
      return interaction.editReply(chatStatusView(await service.getLiveChatStatus(project.guildId, project.channelId)));
    }
    if (subcommand === "off") {
      const current = await service.getLiveChatStatus(interaction.guildId, interaction.channelId);
      await service.configureLiveChat({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        enabled: false,
        mode: current.mode,
        prefix: current.prefix,
        historyLimit: current.historyLimit,
        actor,
      });
      return interaction.editReply(chatStatusView(await service.getLiveChatStatus(interaction.guildId, interaction.channelId)));
    }
    if (subcommand === "status") {
      return interaction.editReply(chatStatusView(await service.getLiveChatStatus(interaction.guildId, interaction.channelId)));
    }
    if (subcommand === "test") {
      if (!chatResponder) throw new Error("GPT 응답기가 초기화되지 않았습니다.");
      const prompt = interaction.options.getString("prompt", true);
      const project = await service.requireProject(interaction.guildId, interaction.channelId);
      const status = await service.getLiveChatStatus(interaction.guildId, interaction.channelId);
      const history = (project.liveChatTurns || []).slice(-(status.historyLimit || 8));
      const result = await chatResponder.respond({
        project,
        history,
        message: {
          id: `test-${interaction.id}`,
          authorId: interaction.user.id,
          authorName: interaction.user.globalName || interaction.user.username,
          content: prompt,
          source: `discord-command#${interaction.id}`,
        },
      });
      return interaction.editReply(chatTestView({
        inputMessages: [...history, { role: "user", authorName: interaction.user.globalName || interaction.user.username, content: prompt }],
        output: result.text,
        responseId: result.diagnostics.responseId,
        model: result.diagnostics.model,
        latencyMs: result.diagnostics.latencyMs,
      }));
    }
    throw new Error("지원하지 않는 chat 명령입니다.");
  }

  async function sendPackage(interaction) {
    const artifactIds = interaction.isChatInputCommand?.()
      ? csv(interaction.options.getString("artifacts"))
      : null;
    const packaged = await service.createPackage({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      artifactIds,
      actor: actorFromInteraction(interaction),
    });
    return respond(interaction, {
      content: `패키지 생성 완료 · ${packaged.zipSizeBytes.toLocaleString()} bytes · SHA-256 ${packaged.zipSha256.slice(0, 12)}…`,
      files: [
        { attachment: packaged.zipPath, name: path.basename(packaged.zipPath) },
        { attachment: packaged.manifestPath, name: path.basename(packaged.manifestPath) },
      ],
      allowedMentions: { parse: [] },
    }, { edit: true });
  }

  async function handlePackage(interaction) {
    await interaction.deferReply();
    return sendPackage(interaction);
  }

  async function handleArtifact(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const taskId = interaction.options.getString("task", true);
    const attachment = interaction.options.getAttachment("file", true);
    const actor = actorFromInteraction(interaction);
    const project = await service.assertTaskAccess({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      taskId,
      actor,
    });
    const artifact = await downloadArtifact({
      attachment,
      projectId: project.id,
      taskId,
      artifactDir: config.storage.artifactDir,
      maxBytes: config.storage.maxPackageBytes,
      fetchImpl,
    });
    artifact.version = interaction.options.getString("version", true);
    artifact.required = interaction.options.getBoolean("required") || false;
    artifact.source = `discord-attachment#${interaction.guildId}/${interaction.channelId}/${attachment.id}`;
    try {
      await service.addArtifact({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        artifact,
        actor,
      });
    } catch (error) {
      await rm(artifact.storagePath, { force: true }).catch(() => undefined);
      throw error;
    }
    return interaction.editReply(`산출물 ${artifact.filename} (${artifact.version})을 ${taskId}에 등록했습니다.`);
  }

  async function handleMessageCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const project = await requireGuild(interaction);
    const event = normalizeDiscordMessage(interaction.targetMessage, { projectId: project.id });
    if (!event) throw new Error("봇 메시지나 개인 메시지는 근거로 수집하지 않습니다.");
    const result = await service.captureEvidence({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      event,
      actor: actorFromInteraction(interaction),
    });
    return interaction.editReply({
      content: result.added ? "선택한 메시지를 근거로 추가했습니다." : "이미 추가된 근거입니다.",
    });
  }

  async function handleComponent(interaction) {
    const { action, projectId, revision } = parseComponentId(interaction.customId);
    const next = action === "project.next" && interaction.isStringSelectMenu() ? interaction.values[0] : null;
    if (next === "artifact") {
      await interaction.deferReply({ ephemeral: true });
    } else if (next === "package" || action === "package.create") {
      await interaction.deferReply({ ephemeral: true });
    } else {
      await interaction.deferUpdate();
    }
    const project = await requireGuild(interaction);
    if (projectId !== project.id) throw new Error("다른 프로젝트의 오래된 버튼입니다.");
    if (action === "assignment.confirm") {
      const updated = await service.confirmAssignments({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        revision,
        confirmedBy: interaction.user.id,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply(assignmentView(projectResult(updated), updated));
    }
    if (action === "assignment.reassign") {
      if (revision != null && revision !== project.revision) throw new Error("더 최신 배정안이 있습니다. 새 화면에서 다시 시도해 주세요.");
      const updated = await service.proposeAssignments({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        requestedBy: interaction.user.id,
        actor: actorFromInteraction(interaction),
      });
      return interaction.editReply(assignmentView(projectResult(updated), updated));
    }
    if (action === "project.next" && interaction.isStringSelectMenu()) {
      if (next === "artifact") {
        return interaction.editReply({
          content: "`/artifact upload`에서 Task, 파일, 버전을 선택해 등록하세요.",
        });
      }
      if (next === "package") {
        return sendPackage(interaction);
      }
      const result = await service.saveProgress({ guildId: interaction.guildId, channelId: interaction.channelId });
      return interaction.editReply(statusView(result.progress, result.project));
    }
    if (action === "progress.refresh") {
      const result = await service.saveProgress({ guildId: interaction.guildId, channelId: interaction.channelId });
      return interaction.editReply(statusView(result.progress, result.project));
    }
    if (action === "package.create") {
      return sendPackage(interaction);
    }
    if (action === "progress.task" && interaction.isStringSelectMenu()) {
      const taskId = interaction.values[0];
      const result = await service.saveProgress({ guildId: interaction.guildId, channelId: interaction.channelId });
      const filtered = {
        ...result.progress,
        taskProgress: result.progress.taskProgress.filter((item) => item.taskId === taskId),
      };
      return interaction.editReply(statusView(filtered, result.project));
    }
    throw new Error("지원하지 않는 버튼입니다.");
  }

  return async function route(interaction) {
    try {
      if (interaction.isMessageContextMenuCommand?.() && interaction.commandName === "근거로 추가") {
        return await handleMessageCommand(interaction);
      }
      if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
        return await handleComponent(interaction);
      }
      if (!interaction.isChatInputCommand?.()) return undefined;
      if (interaction.commandName === "project") return await handleProject(interaction);
      if (interaction.commandName === "task") return await handleTask(interaction);
      if (interaction.commandName === "assign") return await handleAssign(interaction);
      if (interaction.commandName === "goal-referee") return await handleGoalReferee(interaction);
      if (interaction.commandName === "status") return await handleStatus(interaction);
      if (interaction.commandName === "package") return await handlePackage(interaction);
      if (interaction.commandName === "artifact") return await handleArtifact(interaction);
      if (interaction.commandName === "chat") return await handleChat(interaction);
      throw new Error("지원하지 않는 명령입니다.");
    } catch (error) {
      logger.warn?.("User request failed", { message: error.message, command: interaction.commandName });
      const payload = errorView(error.message);
      if (interaction.deferred) {
        const { flags, ...editable } = payload;
        return interaction.editReply(editable);
      }
      if (interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    }
  };
}

export { parseComponentId };
