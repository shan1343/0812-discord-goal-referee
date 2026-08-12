import assert from "node:assert/strict";
import test from "node:test";
import { createChatResponder } from "../src/ai/chat.js";
import { createLiveChatHandler, triggeredContent } from "../src/discord/live-chat.js";

function discordMessage(overrides = {}) {
  const edits = [];
  const replies = [];
  return {
    id: "150000000000000099",
    guildId: "150000000000000001",
    channelId: "150000000000000002",
    content: "!gpt 오늘 할 일을 정리해줘",
    createdAt: new Date("2026-08-12T04:00:00.000Z"),
    author: { id: "150000000000000003", username: "tester", bot: false },
    client: { user: { id: "150000000000000010" } },
    mentions: { users: { has: () => false } },
    channel: { sendTyping: async () => undefined },
    async reply(payload) {
      replies.push(payload);
      return {
        async edit(next) {
          edits.push(next);
          return next;
        },
      };
    },
    _replies: replies,
    _edits: edits,
    ...overrides,
  };
}

test("mock responder returns explicit diagnostics without a network client", async () => {
  const responder = createChatResponder({ mode: "mock" });
  const result = await responder.respond({ message: { id: "m1", content: "연결 시험" } });

  assert.match(result.text, /모의 응답/);
  assert.match(result.text, /연결 시험/);
  assert.equal(result.diagnostics.mode, "mock");
  assert.equal(result.diagnostics.model, "mock");
  assert.deepEqual(result.diagnostics.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
});

test("live responder uses Responses API with store disabled and returns API diagnostics", async () => {
  let request;
  const client = {
    responses: {
      async create(value) {
        request = value;
        return {
          id: "resp_test_123",
          model: "gpt-test",
          output_text: "정상 응답",
          usage: { input_tokens: 15, output_tokens: 4, total_tokens: 19 },
        };
      },
    },
  };
  const responder = createChatResponder({ mode: "live", model: "gpt-test", client });
  const result = await responder.respond({
    project: { id: "p1", goal: { title: "테스트" } },
    history: [{ role: "assistant", content: "이전 답변" }],
    message: { id: "m1", authorId: "u1", content: "현재 질문" },
  });

  assert.equal(request.model, "gpt-test");
  assert.equal(request.store, false);
  assert.match(request.instructions, /untrusted Discord conversation data/);
  assert.equal(JSON.parse(request.input).currentDiscordMessage.content, "현재 질문");
  assert.equal("authorId" in JSON.parse(request.input).currentDiscordMessage, false);
  assert.equal("id" in JSON.parse(request.input).currentDiscordMessage, false);
  assert.equal(result.text, "정상 응답");
  assert.deepEqual(result.diagnostics.usage, { inputTokens: 15, outputTokens: 4, totalTokens: 19 });
  assert.equal(result.diagnostics.responseId, "resp_test_123");
});

test("trigger modes strip prefix and mention from the GPT input", () => {
  const message = discordMessage({
    content: "<@150000000000000010> 상태 알려줘",
    mentions: { users: { has: (id) => id === "150000000000000010" } },
  });
  assert.equal(triggeredContent(message, { trigger: "mention", prefix: "!gpt" }, "150000000000000010"), "상태 알려줘");
  assert.equal(triggeredContent(discordMessage(), { trigger: "prefix", prefix: "!gpt" }, "bot"), "오늘 할 일을 정리해줘");
});

test("live handler ignores private, bot, webhook, and empty messages", async () => {
  let lookups = 0;
  const handler = createLiveChatHandler({
    service: { getProject: async () => { lookups += 1; return null; } },
    responder: { respond: async () => ({ text: "unused", diagnostics: {} }) },
  });

  assert.equal((await handler(discordMessage({ guildId: null }))).reason, "direct_message");
  assert.equal((await handler(discordMessage({ author: { id: "u", bot: true } }))).reason, "bot");
  assert.equal((await handler(discordMessage({ webhookId: "w" }))).reason, "webhook");
  assert.equal((await handler(discordMessage({ content: "  " }))).reason, "empty");
  assert.equal(lookups, 0);
});

test("live handler relays an opted-in message, stores bounded history, and displays the trace", async () => {
  const saved = [];
  const received = [];
  const project = {
    id: "p1",
    channelId: "150000000000000002",
    liveChat: {
      enabled: true,
      trigger: "prefix",
      prefix: "!gpt",
      historyEnabled: true,
      historyLimit: 2,
      cooldownMs: 0,
      showTrace: true,
      history: [
        { role: "user", content: "오래된 질문" },
        { role: "assistant", content: "오래된 답변" },
        { role: "user", content: "최근 질문" },
      ],
    },
  };
  const message = discordMessage();
  const handler = createLiveChatHandler({
    service: {
      getProject: async () => project,
      recordLiveChatTurn: async (value) => saved.push(value),
    },
    responder: {
      async respond(value) {
        received.push(value);
        return {
          text: "오늘은 T-01부터 진행하세요.",
          diagnostics: {
            mode: "live",
            responseId: "resp_123",
            model: "gpt-test",
            usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
            latencyMs: 25,
          },
        };
      },
    },
    config: {},
    logger: { info() {}, warn() {}, error() {} },
  });

  const outcome = await handler(message);
  assert.equal(outcome.processed, true);
  assert.equal(received[0].message.content, "오늘 할 일을 정리해줘");
  assert.deepEqual(received[0].history.map((item) => item.content), ["오래된 답변", "최근 질문"]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].maxTurns, 2);
  assert.equal(saved[0].turn.responseId, "resp_123");
  assert.match(message._replies[0].content, /Discord 메시지 수신 완료/);
  assert.match(message._edits[0].content, /GPT 응답 수신 완료/);
  assert.match(message._edits[0].content, /resp_123/);
  assert.match(message._edits[0].content, /오늘은 T-01/);
});

test("same-channel messages are sent to the responder serially", async () => {
  const project = {
    id: "p1",
    channelId: "150000000000000002",
    liveChat: { enabled: true, trigger: "all", cooldownMs: 0, showTrace: false },
  };
  let active = 0;
  let peak = 0;
  const order = [];
  const handler = createLiveChatHandler({
    service: { getProject: async () => project },
    responder: {
      async respond({ message }) {
        active += 1;
        peak = Math.max(peak, active);
        order.push(`start:${message.id}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(`end:${message.id}`);
        active -= 1;
        return { text: "ok", diagnostics: { mode: "mock", model: "mock", usage: {}, latencyMs: 0 } };
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  const first = discordMessage({ id: "1", content: "첫째" });
  const second = discordMessage({ id: "2", content: "둘째" });
  await Promise.all([handler(first), handler(second)]);

  assert.equal(peak, 1);
  assert.deepEqual(order, ["start:1", "end:1", "start:2", "end:2"]);
});

test("the same Discord message ID is not sent to GPT twice", async () => {
  const project = { id: "p1", channelId: "150000000000000002", liveChat: { enabled: true, trigger: "all", cooldownMs: 0, showTrace: false } };
  let calls = 0;
  const handler = createLiveChatHandler({
    service: { getProject: async () => project },
    responder: { async respond() { calls += 1; return { text: "ok", diagnostics: { mode: "mock", model: "mock", usage: {}, latencyMs: 0 } }; } },
    logger: { info() {}, warn() {}, error() {} },
  });
  const message = discordMessage({ id: "duplicate", content: "same" });
  await Promise.all([handler(message), handler(message)]);
  assert.equal(calls, 1);
});
