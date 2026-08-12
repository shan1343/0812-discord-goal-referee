import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createExtractor } from "../src/ai/extract.js";
import { loadConfig } from "../src/app/config.js";
import { ProjectService } from "../src/app/project-service.js";
import { sha256File } from "../src/packaging/create-package.js";
import { ProjectStore } from "../src/storage/project-store.js";

const GUILD = "150000000000000001";
const CHANNEL = "150000000000000002";
const LEADER = "150000000000000003";
const MEMBER = "150000000000000004";
const OUTSIDER = "150000000000000005";

async function setup(context) {
  const directory = await mkdtemp(path.join(tmpdir(), "project-service-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const config = loadConfig({ ARTIFACT_DIR: directory, DATABASE_PATH: ":memory:" }, directory);
  const store = new ProjectStore({ filePath: ":memory:" });
  const service = new ProjectService({ store, extractor: createExtractor({ mode: "mock" }), config });
  const leader = { id: LEADER, canManageGuild: false };
  await service.createProject({
    guildId: GUILD,
    channelId: CHANNEL,
    createdBy: LEADER,
    name: "Service test",
    goal: "Ship verified package",
  });
  await service.setMembers({
    guildId: GUILD,
    channelId: CHANNEL,
    members: [{ id: MEMBER, displayName: "Member" }],
    changedBy: LEADER,
    actor: leader,
  });
  return { config, directory, leader, service, store };
}

test("only the project owner or a guild manager can change members", async (context) => {
  const { service } = await setup(context);
  await assert.rejects(() => service.setMembers({
    guildId: GUILD,
    channelId: CHANNEL,
    members: [],
    changedBy: OUTSIDER,
    actor: { id: OUTSIDER, canManageGuild: false },
  }), /생성자 또는 서버 관리자/);
  const project = await service.setMembers({
    guildId: GUILD,
    channelId: CHANNEL,
    members: [{ id: MEMBER, displayName: "Member" }],
    changedBy: OUTSIDER,
    actor: { id: OUTSIDER, canManageGuild: true },
  });
  assert.equal(project.members.length, 1);
});

test("member roster no-ops preserve assignments and locked owners cannot be removed", async (context) => {
  const { service, leader } = await setup(context);
  await service.addTask({
    guildId: GUILD,
    channelId: CHANNEL,
    title: "Locked",
    lockedOwnerId: MEMBER,
    createdBy: LEADER,
    actor: leader,
  });
  const proposed = await service.proposeAssignments({
    guildId: GUILD,
    channelId: CHANNEL,
    requestedBy: LEADER,
    actor: leader,
  });
  const unchanged = await service.setMembers({
    guildId: GUILD,
    channelId: CHANNEL,
    members: [{ id: MEMBER, displayName: "Member" }],
    changedBy: LEADER,
    actor: leader,
  });
  assert.deepEqual(unchanged.assignments, proposed.assignments);
  await assert.rejects(() => service.setMembers({
    guildId: GUILD,
    channelId: CHANNEL,
    members: [{ id: OUTSIDER, displayName: "Replacement" }],
    changedBy: LEADER,
    actor: leader,
  }), /고정 담당 Task/);
});

test("outsiders cannot mutate or package a project", async (context) => {
  const { service, leader } = await setup(context);
  await service.addTask({
    guildId: GUILD,
    channelId: CHANNEL,
    title: "Task",
    createdBy: LEADER,
    actor: leader,
  });
  const outsider = { id: OUTSIDER, canManageGuild: false };
  await assert.rejects(() => service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    text: "tampered",
    changedBy: OUTSIDER,
    actor: outsider,
  }), /등록 팀원/);
  await assert.rejects(() => service.createPackage({
    guildId: GUILD,
    channelId: CHANNEL,
    actor: outsider,
  }), /등록 팀원/);
  await assert.rejects(() => service.deleteProject({
    guildId: GUILD,
    channelId: CHANNEL,
    actor: outsider,
  }), /생성자 또는 서버 관리자/);
});

test("partial assignment cannot be confirmed and unknown owners are rejected", async (context) => {
  const { service, leader } = await setup(context);
  for (const title of ["First", "Second"]) {
    await service.addTask({
      guildId: GUILD,
      channelId: CHANNEL,
      title,
      lockedOwnerId: MEMBER,
      createdBy: LEADER,
      actor: leader,
    });
  }
  await assert.rejects(() => service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    ownerId: OUTSIDER,
    changedBy: LEADER,
    actor: leader,
  }), /등록된 팀원/);
  const proposed = await service.proposeAssignments({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    requestedBy: LEADER,
    actor: leader,
  });
  assert.equal(proposed.assignmentState, "needs_input");
  await assert.rejects(() => service.confirmAssignments({
    guildId: GUILD,
    channelId: CHANNEL,
    revision: proposed.revision,
    confirmedBy: LEADER,
    actor: leader,
  }), /모든 Task/);
});

test("directly fixing one AI assignment never marks the whole project confirmed", async (context) => {
  const { service, leader } = await setup(context);
  for (const title of ["First", "Second"]) {
    await service.addTask({
      guildId: GUILD,
      channelId: CHANNEL,
      title,
      lockedOwnerId: MEMBER,
      createdBy: LEADER,
      actor: leader,
    });
  }
  await service.proposeAssignments({
    guildId: GUILD,
    channelId: CHANNEL,
    requestedBy: LEADER,
    actor: leader,
  });
  const updated = await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    ownerId: MEMBER,
    changedBy: LEADER,
    actor: leader,
  });
  assert.equal(updated.assignmentState, "needs_input");
  assert.deepEqual(updated.assignments.map((item) => item.status), ["proposed", "confirmed"]);
});

test("reopening a manually done task revokes only its automatic confirmations", async (context) => {
  const { service, leader } = await setup(context);
  await service.addTask({
    guildId: GUILD,
    channelId: CHANNEL,
    title: "Review",
    doneConditions: "Reviewer confirms",
    createdBy: LEADER,
    actor: leader,
  });
  await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    state: "done",
    changedBy: LEADER,
    actor: leader,
  });
  assert.equal((await service.getProgress({ guildId: GUILD, channelId: CHANNEL })).goalPercentage, 100);
  await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    state: "not_started",
    changedBy: LEADER,
    actor: leader,
  });
  const progress = await service.getProgress({ guildId: GUILD, channelId: CHANNEL });
  assert.equal(progress.goalPercentage, 0);
  assert.equal(progress.taskProgress[0].state, "not_started");
});

test("reopening preserves an independently recorded manual checkpoint", async (context) => {
  const { service, leader } = await setup(context);
  await service.addTask({
    guildId: GUILD,
    channelId: CHANNEL,
    title: "Manual evidence",
    doneConditions: "Reviewer confirms",
    createdBy: LEADER,
    actor: leader,
  });
  const project = await service.requireProject(GUILD, CHANNEL);
  await service.recordCheckpoint({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    checkpointId: project.tasks[0].checkpoints[0].id,
    confirmedBy: LEADER,
    actor: leader,
  });
  await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    state: "done",
    changedBy: LEADER,
    actor: leader,
  });
  await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    state: "not_started",
    changedBy: LEADER,
    actor: leader,
  });
  const reopened = await service.requireProject(GUILD, CHANNEL);
  assert.equal(reopened.checkpointEvidence.length, 1);
  assert.ok(reopened.checkpointEvidence[0].id.startsWith("MANUAL-CHK-"));
  assert.equal((await service.getProgress({ guildId: GUILD, channelId: CHANNEL })).goalPercentage, 100);
});

test("required uploads become source-linked checkpoints and remain traceable in manifest", async (context) => {
  const { directory, service, leader } = await setup(context);
  await service.addTask({
    guildId: GUILD,
    channelId: CHANNEL,
    title: "Artifact task",
    doneConditions: "Human confirms",
    createdBy: LEADER,
    actor: leader,
  });
  const storagePath = path.join(directory, "artifact.txt");
  await writeFile(storagePath, "verified\n", "utf8");
  await service.addArtifact({
    guildId: GUILD,
    channelId: CHANNEL,
    actor: leader,
    artifact: {
      id: "ART-1",
      taskId: "T-01",
      filename: "artifact.txt",
      storagePath,
      sha256: await sha256File(storagePath),
      source: "discord-attachment#150000000000000010/150000000000000011/150000000000000012",
      status: "available",
      required: true,
    },
  });
  let project = await service.requireProject(GUILD, CHANNEL);
  assert.equal(project.tasks[0].checkpoints.length, 2);
  assert.equal(project.artifacts[0].checkpointId, project.tasks[0].checkpoints[1].id);
  await service.updateTask({
    guildId: GUILD,
    channelId: CHANNEL,
    taskId: "T-01",
    state: "done",
    changedBy: LEADER,
    actor: leader,
  });
  const packaged = await service.createPackage({ guildId: GUILD, channelId: CHANNEL, actor: leader });
  const manifest = JSON.parse(await readFile(packaged.manifestPath, "utf8"));
  assert.equal(manifest.files[0].checkpointId, project.tasks[0].checkpoints[1].id);
  assert.ok(manifest.checkpointEvidence[0].source.startsWith("discord-user-input#"));
  assert.equal(manifest.members[0].id, MEMBER);
});
