import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { normalizeDiscordMessage } from "../src/etl/discord-event.js";
import { ProjectStore } from "../src/storage/project-store.js";

const fixtureDirectory = new URL("../fixtures/", import.meta.url);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(name, fixtureDirectory), "utf8"));
}

test("normalizes a guild message without coercing Discord IDs", async () => {
  const message = await fixture("discord-message.json");
  const event = normalizeDiscordMessage(message, { projectId: "PROJECT-01" });

  assert.deepEqual(event, {
    id: "150123456789012345",
    projectId: "PROJECT-01",
    source_type: "message",
    occurred_at: "2026-08-12T03:05:00.000Z",
    actor: "민지",
    text: "발표 자료 초안을 오늘 16시까지 올릴게요.",
    source: "discord-message#150000000000000002/150123456789012345",
    metadata: {
      guild_id: "150000000000000001",
      channel_id: "150000000000000002",
      message_id: "150123456789012345",
      author_id: "150000000000000003",
      attachments: [
        {
          id: "150000000000000004",
          name: "outline.pdf",
          content_type: "application/pdf",
          size: 2048,
        },
      ],
    },
  });
  assert.equal(typeof event.id, "string");
  assert.equal(typeof event.metadata.guild_id, "string");
  assert.equal("url" in event.metadata.attachments[0], false);
});

test("ignores bot-authored and direct messages", async () => {
  const botMessage = await fixture("discord-bot-message.json");
  assert.equal(normalizeDiscordMessage(botMessage, { projectId: "PROJECT-01" }), null);

  const directMessage = {
    ...botMessage,
    guildId: null,
    author: { ...botMessage.author, bot: false },
  };
  assert.equal(normalizeDiscordMessage(directMessage, { projectId: "PROJECT-01" }), null);
});

test("normalizes an attachment-only message to a non-empty event", () => {
  const event = normalizeDiscordMessage(
    {
      id: "150123456789012347",
      guildId: "150000000000000001",
      channelId: "150000000000000002",
      content: "   ",
      createdTimestamp: 1_786_504_000_000,
      author: { id: "150000000000000003", username: "minji", bot: false },
      attachments: new Map([
        [
          "150000000000000005",
          { id: "150000000000000005", name: "result.zip", size: 100 },
        ],
      ]),
    },
    { projectId: "PROJECT-01" },
  );

  assert.equal(event.text, "[attachment] result.zip");
  assert.equal(event.metadata.attachments[0].id, "150000000000000005");
});

test("in-memory store scopes projects by projectKey and returns defensive copies", async () => {
  const times = [
    new Date("2026-08-12T04:00:00.000Z"),
    new Date("2026-08-12T04:05:00.000Z"),
  ];
  const store = new ProjectStore({ filePath: ":memory:", clock: () => times.shift() });
  await store.init();

  const first = await store.put("guild-a:channel-a", { title: "A", tasks: [] });
  await store.put("guild-a:channel-b", { title: "B", tasks: [] });
  first.tasks.push({ id: "local-only" });

  assert.deepEqual(await store.get("guild-a:channel-a"), {
    title: "A",
    tasks: [],
    projectKey: "guild-a:channel-a",
    createdAt: "2026-08-12T04:00:00.000Z",
    updatedAt: "2026-08-12T04:00:00.000Z",
  });
  assert.equal((await store.get("guild-a:channel-b")).title, "B");
  assert.equal(await store.get("missing:project"), null);
});

test("create inserts once atomically and refuses replacement", async () => {
  const store = new ProjectStore({ filePath: ":memory:" });
  const [first, second] = await Promise.allSettled([
    store.create("guild:channel", { title: "first" }),
    store.create("guild:channel", { title: "second" }),
  ]);
  assert.equal([first, second].filter((item) => item.status === "fulfilled").length, 1);
  assert.equal([first, second].filter((item) => item.status === "rejected").length, 1);
  assert.ok(["first", "second"].includes((await store.get("guild:channel")).title));
});

test("update preserves creation time and serializes concurrent mutations", async () => {
  const times = [
    new Date("2026-08-12T04:00:00.000Z"),
    new Date("2026-08-12T04:01:00.000Z"),
    new Date("2026-08-12T04:02:00.000Z"),
  ];
  const store = new ProjectStore({ filePath: ":memory:", clock: () => times.shift() });
  await store.put("guild:channel", { count: 0 });

  await Promise.all([
    store.update("guild:channel", (project) => ({ ...project, count: project.count + 1 })),
    store.update("guild:channel", (project) => ({ ...project, count: project.count + 1 })),
  ]);

  const project = await store.get("guild:channel");
  assert.equal(project.count, 2);
  assert.equal(project.createdAt, "2026-08-12T04:00:00.000Z");
  assert.equal(project.updatedAt, "2026-08-12T04:02:00.000Z");
});

test("addEvidence is idempotent by Discord message ID", async () => {
  const times = [
    new Date("2026-08-12T04:00:00.000Z"),
    new Date("2026-08-12T04:01:00.000Z"),
  ];
  const store = new ProjectStore({ filePath: ":memory:", clock: () => times.shift() });
  await store.put("guild:channel", { evidence: [] });
  const evidence = {
    id: "150123456789012345",
    source: "discord-message#150000000000000002/150123456789012345",
    text: "완료 파일입니다.",
  };

  const added = await store.addEvidence("guild:channel", evidence);
  const duplicate = await store.addEvidence("guild:channel", {
    message_id: "150123456789012345",
    source: evidence.source,
    text: "중복 이벤트",
  });

  assert.deepEqual(duplicate, added);
  assert.deepEqual(duplicate.evidence, [evidence]);
  assert.equal(duplicate.updatedAt, "2026-08-12T04:01:00.000Z");
});

test("file store persists atomically readable JSON and can be reopened", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "discord-project-store-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "nested", "projects.json");
  const clock = () => new Date("2026-08-12T04:00:00.000Z");

  const store = new ProjectStore({ filePath, clock });
  await store.put("guild:channel", { title: "발표 준비" });
  const onDisk = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(onDisk.version, 1);
  assert.equal(onDisk.projects["guild:channel"].title, "발표 준비");

  const reopened = new ProjectStore({ filePath, clock });
  assert.deepEqual(await reopened.get("guild:channel"), await store.get("guild:channel"));
  assert.equal(await reopened.delete("guild:channel"), true);
  assert.equal(await reopened.delete("guild:channel"), false);
  assert.equal((await readFile(filePath, "utf8")).includes("발표 준비"), false);
});
