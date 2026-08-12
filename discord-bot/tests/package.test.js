import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildManifest, createProjectPackage, safeFilename, sha256File } from "../src/packaging/create-package.js";

test("safeFilename prevents path traversal", () => {
  assert.equal(safeFilename("../../secret?.txt"), "secret_.txt");
});

test("package contains a checksum-verified artifact and manifest", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "readiness-package-"));
  const file = path.join(dir, "result.txt");
  await writeFile(file, "ready\n");
  const checksum = await sha256File(file);
  const project = {
    id: "P1",
    guildId: "12345",
    channelId: "67890",
    goal: { title: "Ship demo" },
    revision: 2,
    assignments: [{ taskId: "T1", ownerId: "M1", reason: "Explicit promise", evidenceIds: ["E1"], status: "confirmed" }],
    evidence: [{ id: "E1", actor: "Member", text: "I will prepare it", source: "discord-message#67890/77777" }],
    artifacts: [{
      id: "ART-1",
      taskId: "T1",
      filename: "result.txt",
      storagePath: file,
      sha256: checksum,
      version: "1",
    }],
  };
  const manifest = await buildManifest(project);
  assert.equal(manifest.files[0].sha256, checksum);
  assert.equal(manifest.assignments[0].evidenceIds[0], "E1");
  assert.equal(manifest.evidence[0].source, "discord-message#67890/77777");
  const result = await createProjectPackage({ project, outputDir: path.join(dir, "out") });
  assert.ok((await readFile(result.zipPath)).length > 0);
  assert.match(result.manifestChecksum, /^[a-f0-9]{64}$/);
});

test("package rejects checksum mismatch", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "readiness-package-bad-"));
  const file = path.join(dir, "bad.txt");
  await writeFile(file, "changed");
  const project = {
    id: "P2",
    guildId: "12345",
    channelId: "67890",
    goal: { title: "Test" },
    artifacts: [{ id: "ART-2", taskId: "T1", filename: "bad.txt", storagePath: file, sha256: "0".repeat(64) }],
  };
  await assert.rejects(() => buildManifest(project), /checksum mismatch/);
});
