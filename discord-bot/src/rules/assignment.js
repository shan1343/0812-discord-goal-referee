export class AssignmentValidationError extends Error {
  constructor(errors) {
    super(`Invalid AI assignments: ${errors.map(({ message }) => message).join("; ")}`);
    this.name = "AssignmentValidationError";
    this.errors = errors;
  }
}
function issue(errors, code, path, message) {
  errors.push({ code, path, message });
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function normalizedAssignment(raw, taskId) {
  const ownerId = typeof raw?.ownerId === "string" && raw.ownerId.trim() ? raw.ownerId.trim() : null;
  const status = raw?.status ?? (ownerId == null ? "needs_input" : "proposed");
  const confidence = Number.isFinite(raw?.confidence) ? raw.confidence : null;
  return {
    taskId,
    ownerId,
    reason: typeof raw?.reason === "string" ? raw.reason.trim() : "",
    evidenceIds: uniqueStrings(raw?.evidenceIds),
    confidence,
    blockers: uniqueStrings(raw?.blockers),
    alternativeOwnerId: typeof raw?.alternativeOwnerId === "string" && raw.alternativeOwnerId.trim()
      ? raw.alternativeOwnerId.trim()
      : null,
    status,
  };
}

export function validateAssignments(candidate, { project, messages = [] } = {}) {
  const errors = [];
  if (!project || typeof project !== "object") {
    throw new TypeError("project is required");
  }
  if (!Array.isArray(messages)) throw new TypeError("messages must be an array");

  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const taskIds = new Set(tasks.map(({ id }) => id));
  const memberIds = new Set((project.members ?? []).map(({ id }) => id));
  const messageIds = new Set(messages.map(({ id }) => id));
  const rawAssignments = Array.isArray(candidate?.assignments) ? candidate.assignments : [];
  if (!candidate || typeof candidate !== "object") {
    issue(errors, "candidate.invalid", "$", "The AI result must be an object.");
  } else if (!Array.isArray(candidate.assignments)) {
    issue(errors, "assignments.invalid", "assignments", "assignments must be an array.");
  }

  const byTask = new Map();
  rawAssignments.forEach((raw, index) => {
    const path = `assignments[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issue(errors, "assignment.invalid", path, `${path} must be an object.`);
      return;
    }
    const taskId = typeof raw.taskId === "string" ? raw.taskId.trim() : "";
    if (!taskIds.has(taskId)) {
      issue(errors, "task.unknown", `${path}.taskId`, `${path} references unknown task ${taskId || "(empty)"}.`);
      return;
    }
    if (byTask.has(taskId)) {
      issue(errors, "task.duplicate", `${path}.taskId`, `Task ${taskId} has more than one assignment.`);
      return;
    }
    byTask.set(taskId, { raw, index });
  });

  const normalized = [];
  for (const task of tasks) {
    const entry = byTask.get(task.id);
    if (!entry) {
      issue(errors, "task.missing", "assignments", `Task ${task.id} has no assignment.`);
      continue;
    }
    const path = `assignments[${entry.index}]`;
    const assignment = normalizedAssignment(entry.raw, task.id);
    if (assignment.ownerId != null && !memberIds.has(assignment.ownerId)) {
      issue(errors, "owner.unknown", `${path}.ownerId`, `${path} references unknown member ${assignment.ownerId}.`);
    }
    if (assignment.alternativeOwnerId != null && !memberIds.has(assignment.alternativeOwnerId)) {
      issue(errors, "alternative_owner.unknown", `${path}.alternativeOwnerId`, `${path} references unknown alternative member ${assignment.alternativeOwnerId}.`);
    }
    if (task.lockedOwnerId != null && assignment.ownerId !== task.lockedOwnerId) {
      issue(errors, "owner.locked", `${path}.ownerId`, `Task ${task.id} is locked to member ${task.lockedOwnerId}.`);
    }
    if (assignment.status === "confirmed") {
      issue(errors, "status.ai_confirmed", `${path}.status`, "AI output cannot confirm an assignment.");
    } else if (!new Set(["proposed", "needs_input"]).has(assignment.status)) {
      issue(errors, "status.invalid", `${path}.status`, `${path} has invalid status ${assignment.status}.`);
    }
    if (assignment.ownerId == null && assignment.status !== "needs_input") {
      issue(errors, "status.owner_required", `${path}.status`, `Task ${task.id} without an owner must have needs_input status.`);
    }
    if (assignment.confidence != null && (assignment.confidence < 0 || assignment.confidence > 1)) {
      issue(errors, "confidence.range", `${path}.confidence`, `${path}.confidence must be between 0 and 1.`);
    }
    for (const evidenceId of assignment.evidenceIds) {
      if (!messageIds.has(evidenceId)) {
        issue(errors, "evidence.unknown", `${path}.evidenceIds`, `${path} references unknown evidence ${evidenceId}.`);
      }
    }
    normalized.push(assignment);
  }

  for (const [index, taskId] of (candidate?.unassigned ?? []).entries()) {
    if (typeof taskId !== "string" || !taskIds.has(taskId)) {
      issue(errors, "unassigned.unknown", `unassigned[${index}]`, `unassigned references unknown task ${taskId}.`);
    }
  }

  if (errors.length) throw new AssignmentValidationError(errors);
  const unassigned = normalized.filter(({ ownerId }) => ownerId == null).map(({ taskId }) => taskId);
  return {
    assignments: normalized,
    unassigned,
    questions: uniqueStrings(candidate?.questions),
    warnings: uniqueStrings(candidate?.warnings),
  };
}

export async function assignProject({ project, messages = [], extractor } = {}) {
  if (typeof extractor?.extract !== "function") throw new TypeError("extractor.extract is required");
  const candidate = await extractor.extract({ project, messages });
  return validateAssignments(candidate, { project, messages });
}
