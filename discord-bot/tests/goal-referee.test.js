import assert from "node:assert/strict";
import test from "node:test";

import { createGoalReferee, goalRefereeText } from "../src/ai/goal-referee.js";

const messages = [
  { id: "m-1", authorId: "u-1", authorName: "수빈", createdAt: "2026-08-12T09:35:00+09:00", content: "나는 화면 디자인을 맡을 수 있어." },
  { id: "m-2", authorId: "u-2", authorName: "민재", createdAt: "2026-08-12T09:36:00+09:00", content: "나는 FastAPI 백엔드를 맡을게." },
];

test("mock goal referee produces source-backed proposals without a network call", async () => {
  const referee = createGoalReferee({ mode: "mock" });
  const result = await referee.analyze({ guildId: "guild", channelId: "channel", messages });
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].ownerId, "u-2");
  assert.deepEqual(result.tasks[0].evidenceMessageIds, ["m-2"]);
  assert.match(goalRefereeText(result), /Goal Referee/);
});

test("live goal referee rejects invented owner and evidence references", async () => {
  const client = {
    responses: {
      async create() {
        return { output_text: JSON.stringify({
          summary: "제안",
          tasks: [{
            title: "프로토타입 제작",
            ownerId: "invented-user",
            ownerName: "없는 사람",
            reason: "근거 없음",
            evidenceMessageIds: ["invented-message"],
            status: "proposed",
          }],
          questions: [],
        }) };
      },
    },
  };
  const referee = createGoalReferee({ mode: "live", apiKey: "test", model: "gpt-5.6-terra", client });
  const result = await referee.analyze({ guildId: "guild", channelId: "channel", messages });
  assert.equal(result.tasks[0].ownerId, null);
  assert.equal(result.tasks[0].status, "needs_input");
  assert.deepEqual(result.tasks[0].evidenceMessageIds, []);
});
