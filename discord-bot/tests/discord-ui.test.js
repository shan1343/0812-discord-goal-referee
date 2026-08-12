import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ComponentType,
  MessageFlags,
} from "discord.js";

import { buildCommands } from "../src/discord/commands.js";
import {
  actionRows,
  assignmentView,
  chatStatusView,
  chatTestView,
  errorView,
  statusView,
} from "../src/discord/views.js";

function command(name, type = ApplicationCommandType.ChatInput) {
  return buildCommands().find((item) => item.name === name && item.type === type);
}

function subcommand(definition, name) {
  return definition.options.find(
    (item) => item.type === ApplicationCommandOptionType.Subcommand && item.name === name,
  );
}

function embedCharacterCount(embed) {
  return [
    embed.title,
    embed.description,
    embed.footer?.text,
    ...(embed.fields ?? []).flatMap((field) => [field.name, field.value]),
  ].reduce((total, value) => total + (value?.length ?? 0), 0);
}

function assertDiscordPayloadLimits(payload) {
  assert.ok(payload.embeds.length <= 10);
  for (const embed of payload.embeds) {
    assert.ok((embed.title?.length ?? 0) <= 256);
    assert.ok((embed.description?.length ?? 0) <= 4096);
    assert.ok((embed.fields?.length ?? 0) <= 25);
    assert.ok(embedCharacterCount(embed) <= 6000);
    for (const field of embed.fields ?? []) {
      assert.ok(field.name.length <= 256);
      assert.ok(field.value.length <= 1024);
    }
  }
  assert.ok((payload.components?.length ?? 0) <= 5);
}

test("buildCommands returns the complete JSON-ready Discord command surface", () => {
  const definitions = buildCommands();
  assert.deepEqual(
    definitions.map((item) => [item.name, item.type]),
    [
      ["project", ApplicationCommandType.ChatInput],
      ["task", ApplicationCommandType.ChatInput],
      ["assign", ApplicationCommandType.ChatInput],
      ["status", ApplicationCommandType.ChatInput],
      ["package", ApplicationCommandType.ChatInput],
      ["artifact", ApplicationCommandType.ChatInput],
      ["chat", ApplicationCommandType.ChatInput],
      ["근거로 추가", ApplicationCommandType.Message],
    ],
  );

  assert.deepEqual(
    command("project").options.map((item) => item.name),
    ["create", "members", "delete"],
  );
  assert.deepEqual(
    command("task").options.map((item) => item.name),
    ["add", "update"],
  );
  assert.deepEqual(
    command("artifact").options.map((item) => item.name),
    ["upload"],
  );
  assert.deepEqual(
    command("chat").options.map((item) => item.name),
    ["setup", "off", "status", "test"],
  );

  assert.doesNotThrow(() => JSON.stringify(definitions));
});

test("chat command bounds forwarding modes, history size, and test prompt", () => {
  const setup = subcommand(command("chat"), "setup");
  const mode = setup.options.find((item) => item.name === "mode");
  const prefix = setup.options.find((item) => item.name === "prefix");
  const historyLimit = setup.options.find((item) => item.name === "history_limit");
  assert.deepEqual(mode.choices.map((item) => item.value), ["mention", "prefix", "all"]);
  assert.equal(mode.required, true);
  assert.equal(prefix.max_length, 32);
  assert.equal(historyLimit.type, ApplicationCommandOptionType.Integer);
  assert.equal(historyLimit.min_value, 1);
  assert.equal(historyLimit.max_value, 20);

  const testCommand = subcommand(command("chat"), "test");
  const prompt = testCommand.options.find((item) => item.name === "prompt");
  assert.equal(prompt.required, true);
  assert.equal(prompt.max_length, 2000);
});

test("mutating commands use direct slash options with the expected Discord types", () => {
  const create = subcommand(command("project"), "create");
  assert.deepEqual(
    create.options.filter((item) => item.required).map((item) => item.name),
    ["name", "goal", "deadline", "done"],
  );

  const members = subcommand(command("project"), "members");
  assert.equal(members.options.find((item) => item.name === "member").type, ApplicationCommandOptionType.User);

  const update = subcommand(command("task"), "update");
  assert.equal(update.options.find((item) => item.name === "owner").type, ApplicationCommandOptionType.User);
  assert.equal(update.options.find((item) => item.name === "state").choices.length, 6);

  const upload = subcommand(command("artifact"), "upload");
  assert.equal(upload.options.find((item) => item.name === "file").type, ApplicationCommandOptionType.Attachment);
  assert.deepEqual(
    upload.options.filter((item) => item.required).map((item) => item.name),
    ["task", "file", "version"],
  );
});

test("actionRows creates bounded buttons and a select menu without network access", () => {
  const rows = actionRows("project-1", 7);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, ComponentType.ActionRow);
  assert.equal(rows[1].type, ComponentType.ActionRow);
  assert.equal(rows[1].components[0].type, ComponentType.StringSelect);

  const ids = rows.flatMap((row) => row.components.map((component) => component.custom_id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.length <= 100));
  assert.ok(ids.some((id) => id.startsWith("assignment.confirm|project-1|r7")));

  const longRows = actionRows("p".repeat(300), "revision".repeat(20));
  assert.ok(
    longRows.flatMap((row) => row.components).every((component) => component.custom_id.length <= 100),
  );
});

test("assignmentView shows source-backed assignments without person rankings", () => {
  const payload = assignmentView(
    {
      revision: 3,
      mode: "rules",
      assignments: [
        {
          task_id: "task-api",
          owner_id: "member-a",
          status: "proposed",
          confidence: "high",
          reason: "API 경험",
          evidence_ids: ["evidence-1"],
          blockers: ["테스트 데이터 대기"],
        },
        {
          task_id: "task-demo",
          owner_id: null,
          status: "needs_input",
          confidence: "low",
          reason: "가능 시간을 확인해야 함",
          evidence_ids: [],
          blockers: [],
        },
      ],
      evidence: [{ id: "evidence-1", quote: "FastAPI 통합은 제가 맡겠습니다." }],
      unassigned: ["task-demo"],
      questions: ["발표 리허설 가능한 시간을 알려 주세요."],
    },
    {
      id: "summer-camp",
      name: "여름 캠프 데모",
      goal: { title: "검증 가능한 데모 완성" },
      tasks: [
        { id: "task-api", text: "API 통합" },
        { id: "task-demo", text: "발표 데모" },
      ],
      members: [{ id: "member-a", display_name: "민수" }],
    },
  );

  assertDiscordPayloadLimits(payload);
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /민수/);
  assert.match(serialized, /FastAPI 통합/);
  assert.match(serialized, /테스트 데이터 대기/);
  assert.doesNotMatch(serialized, /순위|기여\s*점수|leaderboard/i);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test("statusView renders overall and per-Task progress, blockers, and next actions", () => {
  const payload = statusView(
    {
      mode: "rules",
      goal_progress: {
        state: "in_progress",
        percent: 62.5,
        unknown_task_ids: ["task-demo"],
      },
      task_progress: [
        {
          task_id: "task-api",
          state: "in_progress",
          percent: 50,
          evidence_ids: ["e1"],
          blocker: "fixture 대기",
          next_action: "통합 테스트 실행",
        },
        {
          task_id: "task-demo",
          state: "unknown",
          percent: null,
          evidence_ids: [],
          blocker: null,
          next_action: "담당자에게 상태 확인",
        },
      ],
      blockers: ["fixture 대기"],
    },
    {
      id: "summer-camp",
      name: "여름 캠프 데모",
      tasks: [
        { id: "task-api", text: "API 통합" },
        { id: "task-demo", text: "발표 데모" },
      ],
    },
  );

  assertDiscordPayloadLimits(payload);
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /63%/);
  assert.match(serialized, /fixture 대기/);
  assert.match(serialized, /통합 테스트 실행/);
  assert.equal(payload.components[1].components[0].type, ComponentType.StringSelect);
  assert.doesNotMatch(serialized, /순위|기여\s*점수|leaderboard/i);
});

test("statusView accepts the rules engine flat percentage and blockers contract", () => {
  const payload = statusView(
    {
      goalPercentage: 40,
      state: "in_progress",
      taskProgress: [
        {
          taskId: "task-ui",
          state: "blocked",
          percentage: 25,
          evidenceIds: ["evidence-1", "evidence-2"],
          blockers: ["Discord 토큰 필요", "권한 설정 필요"],
          nextAction: "봇을 테스트 서버에 초대",
        },
      ],
    },
    {
      id: "discord-mvp",
      tasks: [{ id: "task-ui", text: "Discord 화면 연결" }],
    },
  );

  assertDiscordPayloadLimits(payload);
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /40%/);
  assert.match(serialized, /25%/);
  assert.match(serialized, /Discord 토큰 필요 · 권한 설정 필요/);
  assert.match(serialized, /확인된 근거: 2개/);
});

test("views stay within Discord limits for oversized service responses", () => {
  const repeated = "가".repeat(2000);
  const assignments = Array.from({ length: 40 }, (_, index) => ({
    task_id: `task-${index}`,
    owner_id: `member-${index}`,
    status: "proposed",
    confidence: "medium",
    reason: repeated,
    blockers: [repeated],
  }));
  const payload = assignmentView(
    { assignments, questions: Array(20).fill(repeated), mode: "rules" },
    { id: repeated, name: repeated, goal: repeated },
  );

  assertDiscordPayloadLimits(payload);
  assert.ok(payload.components.flatMap((row) => row.components).every((item) => item.custom_id.length <= 100));
});

test("chatStatusView explains the active forwarding setup without exposing keys", () => {
  const payload = chatStatusView({
    enabled: true,
    mode: "prefix",
    prefix: "!gpt",
    historyLimit: 12,
    aiMode: "live",
    model: "gpt-5.6-terra",
    messageContentIntent: true,
    lastResult: { summary: "최근 메시지 처리 성공" },
  });

  assertDiscordPayloadLimits(payload);
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /!gpt/);
  assert.match(serialized, /12개/);
  assert.match(serialized, /gpt-5\.6-terra/);
  assert.match(serialized, /최근 메시지 처리 성공/);
  assert.doesNotMatch(serialized, /DISCORD_TOKEN|OPENAI_API_KEY|sk-/);
  assert.equal(payload.flags, MessageFlags.Ephemeral);
});

test("chatTestView proves which Discord messages were sent and shows GPT output", () => {
  const payload = chatTestView({
    inputMessages: [
      { authorName: "민수", content: "API 연결을 마쳤습니다." },
      { authorName: "지수", content: "통합 테스트를 시작할게요." },
    ],
    output: "API 연결 완료 후 통합 테스트를 진행 중입니다.",
    model: "gpt-5.6-terra",
    responseId: "resp_123",
    elapsedMs: 824,
  });

  assertDiscordPayloadLimits(payload);
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /민수/);
  assert.match(serialized, /API 연결을 마쳤습니다/);
  assert.match(serialized, /통합 테스트를 진행 중입니다/);
  assert.match(serialized, /resp_123/);
  assert.match(serialized, /824ms/);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(payload.flags, MessageFlags.Ephemeral);
});

test("chat views remain inside Discord limits for oversized histories and output", () => {
  const repeated = "실시간 채팅 ".repeat(300);
  const payload = chatTestView({
    inputMessages: Array.from({ length: 30 }, (_, index) => ({
      authorName: `member-${index}`,
      content: repeated,
    })),
    output: repeated,
    responseId: repeated,
  });

  assertDiscordPayloadLimits(payload);
});

test("errorView is safe, concise, and ephemeral", () => {
  const payload = errorView("오류 ".repeat(1000));
  assert.equal(payload.flags, MessageFlags.Ephemeral);
  assert.equal(payload.embeds[0].color, 0xed4245);
  assert.ok(payload.embeds[0].description.length <= 1800);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assertDiscordPayloadLimits(payload);
});
