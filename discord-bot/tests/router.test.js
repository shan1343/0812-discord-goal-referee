import assert from "node:assert/strict";
import test from "node:test";
import { createInteractionRouter } from "../src/discord/router.js";

const config = { storage: { artifactDir: ".", maxPackageBytes: 1024 } };

test("message evidence command defers before storage work", async () => {
  const order = [];
  const service = {
    async requireProject() { order.push("require"); return { id: "TR-150000000000000002" }; },
    async captureEvidence() { order.push("capture"); return { added: true }; },
  };
  const interaction = {
    commandName: "근거로 추가",
    guildId: "150000000000000001",
    channelId: "150000000000000002",
    user: { id: "150000000000000003" },
    memberPermissions: { has: () => false },
    targetMessage: {
      id: "150000000000000004",
      guildId: "150000000000000001",
      channelId: "150000000000000002",
      content: "I can own this task",
      createdTimestamp: 1_786_504_000_000,
      author: { id: "150000000000000003", username: "member", bot: false },
    },
    isMessageContextMenuCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => false,
    async deferReply() { order.push("defer"); this.deferred = true; },
    async editReply(payload) { order.push("edit"); this.payload = payload; },
  };
  await createInteractionRouter({ service, config, logger: { warn() {} } })(interaction);
  assert.deepEqual(order, ["defer", "require", "capture", "edit"]);
  assert.match(interaction.payload.content, /추가/);
});
test("deferred errors remove immutable ephemeral flags before edit", async () => {
  const interaction = {
    commandName: "근거로 추가",
    guildId: "150000000000000001",
    channelId: "150000000000000002",
    user: { id: "150000000000000003" },
    isMessageContextMenuCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => false,
    async deferReply() { this.deferred = true; },
    async editReply(payload) { this.payload = payload; },
  };
  const service = { async requireProject() { throw new Error("expected failure"); } };
  await createInteractionRouter({ service, config, logger: { warn() {} } })(interaction);
  assert.equal("flags" in interaction.payload, false);
  assert.match(JSON.stringify(interaction.payload), /expected failure/);
});
