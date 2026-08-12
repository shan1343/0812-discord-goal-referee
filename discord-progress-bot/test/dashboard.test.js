import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConversation } from "../src/conversation.js";
import { dashboardContent, progressBar } from "../src/dashboard.js";

test("progressBar clamps percentage and has requested width", () => {
  assert.equal(progressBar(50, 4), "▰▰▱▱");
  assert.equal(progressBar(120, 4), "▰▰▰▰");
});

test("normalizer accepts the supplied export shape and filters bot messages", () => {
  const messages = normalizeConversation({ messages: [
    { author: "GoalReferee", is_bot: true, content: "봇 요약" },
    { author: "예린", day: "수요일", timestamp: "14:34", content: "내 작업은 완료" }
  ] });
  assert.deepEqual(messages, [{ id: "source-2", author: "예린", content: "내 작업은 완료", timestamp: "수요일 14:34", sourceIndex: 2 }]);
});

test("dashboard content exposes overall and individual progress", () => {
  const content = dashboardContent({
    overall_percent: 82, overall_status: "on_track", headline: "통합 동작 확인", done: ["API"], in_progress: ["사용자 테스트"], next_actions: ["테스트 진행"], risks: [], evidence_note: "최근 메시지", members: [{ name: "수빈", percent: 75, status: "working", completed: ["UI"], working_on: ["통합"], next_action: "테스트", blockers: [], evidence_ids: ["1"] }]
  });
  assert.match(content.title, /82%/);
  assert.match(content.description, /▰/);
  assert.ok(content.fields.some((field) => field.value.includes("수빈")));
});

