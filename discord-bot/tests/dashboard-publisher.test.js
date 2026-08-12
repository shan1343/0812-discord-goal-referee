import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardPublisher } from "../src/dashboard/publisher.js";

test("publishes one source-traceable result and creates a channel dashboard link", async () => {
  let request;
  const publisher = createDashboardPublisher({
    apiBaseUrl: "https://api.example.test/",
    ingestToken: "secret",
    webBaseUrl: "https://web.example.test/",
    clock: () => new Date("2026-08-12T09:00:00Z"),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  });
  const result = {
    summary: "근거 기반 제안",
    tasks: [{ title: "통합", ownerId: "1", ownerName: "민지", reason: "약속", evidenceMessageIds: ["9"], status: "proposed" }],
    questions: [],
  };
  const published = await publisher.publish({
    guildId: "guild",
    channelId: "channel",
    result,
    sourceMessageCount: 4,
  });

  assert.equal(published.published, true);
  assert.equal(request.url, "https://api.example.test/api/goal-referee/results");
  assert.equal(request.options.headers.authorization, "Bearer secret");
  assert.equal(JSON.parse(request.options.body).sourceMessageCount, 4);
  assert.equal(publisher.dashboardUrl("channel"), "https://web.example.test/?channel=channel");
});

test("unconfigured publisher is a safe no-op", async () => {
  const publisher = createDashboardPublisher({});
  assert.deepEqual(await publisher.publish({}), { published: false, reason: "not_configured" });
  assert.equal(publisher.dashboardUrl("channel"), null);
});
