const PASSING_STATUSES = new Set(["available", "approved", "complete", "completed", "confirmed", "done", "submitted", "uploaded", "verified"]);
const FAILING_STATUSES = new Set(["blocked", "failed", "missing", "rejected", "removed", "unavailable"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function strings(value) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return [...new Set(asArray(value).map((item) => {
    if (typeof item === "string") return item.trim();
    return String(item?.message ?? item?.reason ?? item?.text ?? "").trim();
  }).filter(Boolean))];
}

function reference(record, camel, snake) {
  return record?.[camel] ?? record?.[snake] ?? null;
}

function evidenceKind(record, fallback) {
  return String(record?.evidenceKind ?? record?.evidence_kind ?? record?.kind ?? record?.type ?? fallback ?? "evidence").toLowerCase();
}

function usableEvidence(record, sourceKind) {
  if (!record || typeof record !== "object" || !record.id) return false;
  if (record.valid === false || record.verified === false || record.available === false) return false;
  if (sourceKind === "approval" && record.approved === false) return false;
  const status = String(record.status ?? "").toLowerCase();
  if (FAILING_STATUSES.has(status)) return false;
  if (status && sourceKind === "approval" && !PASSING_STATUSES.has(status)) return false;
  return true;
}

function normalizeEvidence(checkpointEvidence, artifacts, approvals) {
  return [
    ...asArray(checkpointEvidence).map((record) => ({ record, sourceKind: "evidence" })),
    ...asArray(artifacts).map((record) => ({ record, sourceKind: "artifact" })),
    ...asArray(approvals).map((record) => ({ record, sourceKind: "approval" })),
  ].filter(({ record, sourceKind }) => usableEvidence(record, sourceKind));
}

function kindMatches(requiredKind, item) {
  const required = String(requiredKind ?? "any").toLowerCase();
  if (["", "any", "evidence"].includes(required)) return true;
  const actual = evidenceKind(item.record, item.sourceKind);
  if (required === "message") return ["message", "discord_message", "discord-message", "evidence"].includes(actual);
  if (required === "file") return ["artifact", "file", "attachment"].includes(actual) || item.sourceKind === "artifact";
  if (required === "artifact") return item.sourceKind === "artifact" || ["artifact", "file", "attachment"].includes(actual);
  if (required === "approval") return item.sourceKind === "approval" || actual === "approval";
  if (required === "confirmation") return item.sourceKind === "evidence" || actual === "confirmation";
  return actual === required;
}

function referencesCheckpoint(item, task, checkpoint) {
  const { record } = item;
  const taskId = reference(record, "taskId", "task_id");
  if (taskId != null && taskId !== task.id) return false;
  const checkpointId = reference(record, "checkpointId", "checkpoint_id");
  const checkpointIds = record.checkpointIds ?? record.checkpoint_ids;
  const linkedByCheckpoint = checkpointId === checkpoint.id || asArray(checkpointIds).includes(checkpoint.id);
  const linkedByEvidence = asArray(checkpoint.evidenceIds ?? checkpoint.evidence_ids).includes(record.id);
  return linkedByCheckpoint || linkedByEvidence;
}

function weight(value, fallback = 1) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function round2(value) {
  return value == null ? null : Number(value.toFixed(2));
}

function priorFor(previousProgress, taskId) {
  return asArray(previousProgress).find((item) => reference(item, "taskId", "task_id") === taskId);
}

function taskIsBlocked(task, prior, blockers) {
  const explicit = task.manualState ?? task.state ?? task.status;
  if (explicit === "blocked") return true;
  if (explicit != null) return blockers.length > 0;
  return blockers.length > 0 || (prior?.state ?? prior?.status) === "blocked";
}

function nextActionFor(task, state, missing) {
  if (typeof task.nextAction === "string" && task.nextAction.trim()) return task.nextAction.trim();
  if (typeof task.next_action === "string" && task.next_action.trim()) return task.next_action.trim();
  if (state === "unknown") return "Define checkpoints";
  const blockers = strings(task.blockers ?? task.blocker);
  if (state === "blocked" && blockers.length) return `Resolve blocker: ${blockers[0]}`;
  if (missing.length) {
    const checkpoint = missing[0];
    const kind = checkpoint.evidenceKind ?? checkpoint.evidence_kind ?? "evidence";
    return `Provide ${kind} for ${checkpoint.title ?? checkpoint.id}`;
  }
  return null;
}

function stateFor({ task, percentage, missingRequired, blocked }) {
  if (percentage == null) return "unknown";
  if (blocked) return "blocked";
  if (percentage === 100) return "done";
  if ((task.manualState ?? task.state ?? task.status) === "review_pending") return "review_pending";
  if (percentage > 0 && missingRequired.length && missingRequired.every((checkpoint) =>
    String(checkpoint.evidenceKind ?? checkpoint.evidence_kind ?? "").toLowerCase() === "approval")) {
    return "review_pending";
  }
  return percentage > 0 ? "in_progress" : "not_started";
}

function goalState(percent, taskProgress) {
  if (percent == null) return "unknown";
  if (taskProgress.some(({ state }) => state === "blocked")) return "blocked";
  if (percent === 100) return "done";
  if (taskProgress.some(({ state }) => state === "review_pending")) return "review_pending";
  return percent > 0 ? "in_progress" : "not_started";
}

export function computeProgress({ project, checkpointEvidence = [], artifacts = [], approvals = [], previousProgress = [] } = {}) {
  if (!project || typeof project !== "object") throw new TypeError("project is required");
  const allEvidence = normalizeEvidence(checkpointEvidence, artifacts, approvals);
  const tasks = asArray(project.tasks);
  const taskProgress = tasks.map((task) => {
    const checkpoints = asArray(task.checkpoints);
    const taskBlockers = strings(task.blockers ?? task.blocker);
    if (!checkpoints.length) {
      return {
        taskId: task.id,
        state: "unknown",
        percentage: null,
        evidenceIds: [],
        blockers: taskBlockers,
        nextAction: nextActionFor(task, "unknown", []),
      };
    }

    const checkpointResults = checkpoints.map((checkpoint) => {
      const matches = allEvidence.filter((item) =>
        referencesCheckpoint(item, task, checkpoint) && kindMatches(checkpoint.evidenceKind ?? checkpoint.evidence_kind, item));
      return { checkpoint, matches, earned: matches.length > 0 };
    });
    const totalWeight = checkpointResults.reduce((sum, { checkpoint }) => sum + weight(checkpoint.weight), 0);
    const earnedWeight = checkpointResults.reduce((sum, { checkpoint, earned }) => sum + (earned ? weight(checkpoint.weight) : 0), 0);
    const evidencePercentage = totalWeight > 0 ? round2((earnedWeight / totalWeight) * 100) : 0;
    const prior = priorFor(previousProgress, task.id);
    const blocked = taskIsBlocked(task, prior, taskBlockers);
    const priorPercentage = Number(prior?.percentage ?? prior?.percent);
    const percentage = blocked && Number.isFinite(priorPercentage)
      ? round2(Math.max(0, Math.min(100, priorPercentage), evidencePercentage))
      : evidencePercentage;
    const missing = checkpointResults.filter(({ earned }) => !earned).map(({ checkpoint }) => checkpoint);
    const missingRequired = missing.filter((checkpoint) => checkpoint.required === true);
    const state = stateFor({ task, percentage, missingRequired, blocked });
    const evidenceIds = [...new Set(checkpointResults.flatMap(({ matches }) => matches.map(({ record }) => record.id)))];
    return {
      taskId: task.id,
      state,
      percentage,
      evidenceIds,
      blockers: taskBlockers,
      nextAction: nextActionFor(task, state, missingRequired.length ? missingRequired : missing),
    };
  });

  const known = taskProgress.map((progress, index) => ({ progress, task: tasks[index] }))
    .filter(({ progress }) => progress.percentage != null);
  const totalTaskWeight = known.reduce((sum, { task }) => sum + weight(task.weight), 0);
  const goalPercentage = totalTaskWeight > 0
    ? round2(known.reduce((sum, { task, progress }) => sum + weight(task.weight) * progress.percentage, 0) / totalTaskWeight)
    : null;
  const blockers = [...new Set([...strings(project.blockers), ...taskProgress.flatMap((task) => task.blockers)])];
  const questions = [...new Set([
    ...strings(project.questions),
    ...tasks.flatMap((task) => strings(task.questions)),
  ])];
  const unknownTaskIds = taskProgress.filter(({ state }) => state === "unknown").map(({ taskId }) => taskId);
  const state = goalState(goalPercentage, taskProgress);
  const task_progress = taskProgress.map((task) => ({
    task_id: task.taskId,
    state: task.state,
    percent: task.percentage,
    evidence_ids: task.evidenceIds,
    blocker: task.blockers[0] ?? null,
    next_action: task.nextAction,
  }));

  return {
    taskProgress,
    goalPercentage,
    overallPercentage: goalPercentage,
    blockers,
    questions,
    task_progress,
    goal_progress: {
      state,
      percent: goalPercentage,
      unknown_task_ids: unknownTaskIds,
    },
  };
}
