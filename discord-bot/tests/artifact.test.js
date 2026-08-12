import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assertDiscordAttachmentUrl, downloadArtifact } from "../src/artifacts/registry.js";

test("only accepts Discord-hosted HTTPS attachment URLs", () => {
  assert.equal(assertDiscordAttachmentUrl("https://cdn.discordapp.com/attachments/a/b/file.txt").hostname, "cdn.discordapp.com");
  assert.throws(() => assertDiscordAttachmentUrl("http://cdn.discordapp.com/attachments/a/b"));
  assert.throws(() => assertDiscordAttachmentUrl("https://example.com/private"));
});
test("downloads a bounded attachment with a safe filename", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "artifact-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const body = Buffer.from("verified result");
  const artifact = await downloadArtifact({
    attachment: {
      id: "150000000000000004",
      url: "https://cdn.discordapp.com/attachments/a/b/file.txt",
      name: "../../result?.txt",
      size: body.length,
      contentType: "text/plain",
    },
    projectId: "TR-150000000000000002",
    taskId: "T-01",
    artifactDir: directory,
    maxBytes: 1024,
    fetchImpl: async () => new Response(body, { status: 200, headers: { "content-length": String(body.length) } }),
  });
  assert.equal(artifact.filename, "result_.txt");
  assert.equal(await readFile(artifact.storagePath, "utf8"), "verified result");
  assert.equal(artifact.taskId, "T-01");
});

test("rejects attachment content larger than the configured limit", async () => {
  await assert.rejects(() => downloadArtifact({
    attachment: {
      id: "150000000000000004",
      url: "https://cdn.discordapp.com/attachments/a/b/file.txt",
      name: "file.txt",
      size: 2048,
    },
    projectId: "TR-150000000000000002",
    taskId: "T-01",
    artifactDir: ".",
    maxBytes: 100,
    fetchImpl: async () => { throw new Error("must not fetch"); },
  }), /size limit/);
});
