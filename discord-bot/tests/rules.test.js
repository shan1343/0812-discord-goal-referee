import assert from "node:assert/strict";
import test from "node:test";
import { createExtractor } from "../src/ai/extract.js";
import { AssignmentValidationError, assignProject, validateAssignments } from "../src/rules/assignment.js";
import { computeProgress } from "../src/rules/progress.js";

const project = {
  id: "P1",
  members: [
    { id: "M1", displayName: "민지" },
    { id: "M2", displayName: "준호" },
  ],
  tasks: [
    {
      id: "T1",
      title: "발표 자료",
      weight: 2,
      lockedOwnerId: "M1",
      checkpoints: [
        { id: "C1", title: "초안", weight: 1, required: true, evidenceKind: "artifact" },
        { id: "C2", title: "승인", weight: 1, required: true, evidenceKind: "approval" },
      ],
    },
    {
      id: "T2",
      title: "데모",
      weight: 1,
      checkpoints: [{ id: "C3", title: "실행 증거", weight: 1, required: true, evidenceKind: "message" }],
    },
  ],
};

const messages = [
  { id: "E1", authorId: "M2", content: "T1 초안 올렸습니다", source: "discord-message#1/E1" },
  { id: "E2", authorId: "M2", content: "T2 데모는 @준호 담당", source: "discord-message#1/E2" },
];

test("mock extractor is deterministic and preserves locked owners", async () => {
  const result = await assignProject({ project, messages, extractor: createExtractor({ mode: "mock" }) });
  assert.deepEqual(result.assignments.map(({ taskId, ownerId, status }) => ({ taskId, ownerId, status })), [
    { taskId: "T1", ownerId: "M1", status: "proposed" },
    { taskId: "T2", ownerId: "M2", status: "proposed" },
  ]);
  assert.deepEqual(result.assignments[1].evidenceIds, ["E2"]);
});

test("assignment validation rejects duplicates, invalid references, and AI confirmation", () => {
  const candidate = {
    assignments: [
      { taskId: "T1", ownerId: "M1", evidenceIds: ["missing"], status: "confirmed" },
      { taskId: "T1", ownerId: "M9", evidenceIds: [], status: "proposed" },
    ],
  };
  assert.throws(
    () => validateAssignments(candidate, { project, messages }),
    (error) => error instanceof AssignmentValidationError
      && error.errors.some(({ code }) => code === "task.duplicate")
      && error.errors.some(({ code }) => code === "evidence.unknown")
      && error.errors.some(({ code }) => code === "status.ai_confirmed")
      && error.errors.some(({ code }) => code === "task.missing"),
  );
});

test("an ownerless proposal is normalized to needs_input and unassigned", () => {
  const candidate = {
    assignments: [
      { taskId: "T1", ownerId: "M1", evidenceIds: [], status: "proposed" },
      { taskId: "T2", ownerId: null, evidenceIds: [] },
    ],
  };
  const validated = validateAssignments(candidate, { project, messages });
  assert.equal(validated.assignments[1].status, "needs_input");
  assert.deepEqual(validated.unassigned, ["T2"]);
});

test("live extractor uses Responses structured outputs without a network call", async () => {
  let request;
  const client = {
    responses: {
      async create(value) {
        request = value;
        return {
          output_text: JSON.stringify({
            assignments: project.tasks.map((task) => ({
              taskId: task.id,
              ownerId: task.lockedOwnerId ?? null,
              reason: "test",
              evidenceIds: [],
              confidence: task.lockedOwnerId ? 1 : 0,
              blockers: [],
              alternativeOwnerId: null,
              status: task.lockedOwnerId ? "proposed" : "needs_input",
            })),
            unassigned: ["T2"],
            questions: [],
            warnings: [],
          }),
        };
      },
    },
  };
  const result = await createExtractor({ mode: "live", model: "test-model", client }).extract({ project, messages });
  assert.equal(result.assignments.length, 2);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(request.model, "test-model");
  assert.equal(request.store, false);
});

test("live extractor keeps actor display names separate from Discord author IDs", async () => {
  let request;
  const client = { responses: { async create(value) {
    request = value;
    return { output_text: JSON.stringify({ assignments: [], unassigned: [], questions: [], warnings: [] }) };
  } } };
  const emptyProject = { id: "P2", members: [], tasks: [] };
  await createExtractor({ mode: "live", client }).extract({
    project: emptyProject,
    messages: [{ id: "E3", actor: "민지", text: "완료", metadata: { author_id: "12345" }, source: "discord-message#1/E3" }],
  });
  const payload = JSON.parse(request.input);
  assert.deepEqual(payload.messages[0], {
    id: "E3",
    authorId: "12345",
    actor: "민지",
    content: "완료",
    source: "discord-message#1/E3",
  });
});

test("mock extractor preserves object-shaped task blockers", async () => {
  const blockedProject = {
    id: "P3",
    members: [{ id: "M1", displayName: "민지" }],
    tasks: [{ id: "T3", title: "검토", lockedOwnerId: "M1", blockers: [{ text: "승인 대기" }] }],
  };
  const result = await createExtractor({ mode: "mock" }).extract({ project: blockedProject, messages: [] });
  assert.deepEqual(result.assignments[0].blockers, ["승인 대기"]);
});

test("progress is evidence-weighted, message-count independent, and rounded", () => {
  const result = computeProgress({
    project,
    checkpointEvidence: [
      { id: "MSG-1", taskId: "T2", checkpointId: "C3", kind: "message" },
      { id: "MSG-2", taskId: "T2", checkpointId: "C3", kind: "message" },
    ],
    artifacts: [{ id: "ART-1", taskId: "T1", checkpointId: "C1", status: "available" }],
  });
  assert.equal(result.taskProgress[0].percentage, 50);
  assert.equal(result.taskProgress[0].state, "review_pending");
  assert.equal(result.taskProgress[1].percentage, 100);
  assert.equal(result.goalPercentage, 66.67);
  assert.equal(result.overallPercentage, 66.67);
  assert.equal(result.goal_progress.percent, 66.67);
});

test("blocked tasks retain prior evidence-based progress and checkpoint-less tasks are unknown", () => {
  const blockedProject = {
    ...project,
    tasks: [
      { ...project.tasks[0], manualState: "blocked", blockers: ["reviewer unavailable"] },
      { id: "T3", title: "Undefined", weight: 1, checkpoints: [] },
    ],
  };
  const result = computeProgress({
    project: blockedProject,
    previousProgress: [{ taskId: "T1", state: "blocked", percentage: 75 }],
    artifacts: [{ id: "ART-1", taskId: "T1", checkpointId: "C1" }],
  });
  assert.equal(result.taskProgress[0].state, "blocked");
  assert.equal(result.taskProgress[0].percentage, 75);
  assert.equal(result.taskProgress[1].state, "unknown");
  assert.equal(result.taskProgress[1].percentage, null);
  assert.deepEqual(result.goal_progress.unknown_task_ids, ["T3"]);
});

test("manual done never bypasses required evidence", () => {
  const result = computeProgress({
    project: {
      ...project,
      tasks: [{ ...project.tasks[0], manualState: "done" }],
    },
  });
  assert.equal(result.taskProgress[0].percentage, 0);
  assert.equal(result.taskProgress[0].state, "not_started");
});

test("checkpoint confirmations satisfy confirmation checkpoints", () => {
  const result = computeProgress({
    project: {
      ...project,
      tasks: [{
        id: "T4",
        title: "Confirm result",
        weight: 1,
        checkpoints: [{ id: "C4", title: "Human confirmation", weight: 1, required: true, evidenceKind: "confirmation" }],
      }],
    },
    checkpointEvidence: [{ id: "CHK-4", taskId: "T4", checkpointId: "C4", source: "discord-user-input#1" }],
  });
  assert.equal(result.taskProgress[0].percentage, 100);
  assert.equal(result.taskProgress[0].state, "done");
});
