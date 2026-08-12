import { sha256File } from "../packaging/create-package.js";
import { createExtractor } from "../ai/extract.js";
import { ProjectStore } from "../storage/project-store.js";
import { loadConfig } from "./config.js";
import { ProjectService } from "./project-service.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IDS = {
  guild: "150000000000000001",
  channel: "150000000000000002",
  leader: "150000000000000003",
  memberA: "150000000000000004",
  memberB: "150000000000000005",
  messageA: "150000000000000101",
  messageB: "150000000000000102",
};
const DEMO_ACTOR = { id: IDS.leader, canManageGuild: false };

function evidence({ id, actor, authorId, text }) {
  return {
    id,
    projectId: `TR-${IDS.channel}`,
    source_type: "message",
    occurred_at: "2026-08-12T04:00:00.000Z",
    actor,
    text,
    source: `discord-message#${IDS.channel}/${id}`,
    metadata: {
      guild_id: IDS.guild,
      channel_id: IDS.channel,
      message_id: id,
      author_id: authorId,
      attachments: [],
    },
  };
}

export async function runDemo({ cwd = process.cwd(), logger = console } = {}) {
  const outputDir = path.resolve(cwd, "demo-output");
  const artifactDir = path.join(outputDir, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const config = loadConfig({
    AI_MODE: "mock",
    DATABASE_PATH: ":memory:",
    ARTIFACT_DIR: artifactDir,
    MAX_PACKAGE_BYTES: String(20 * 1024 * 1024),
  }, cwd);
  const store = new ProjectStore({ filePath: ":memory:" });
  const service = new ProjectService({
    store,
    extractor: createExtractor({ mode: "mock" }),
    config,
  });

  await service.createProject({
    guildId: IDS.guild,
    channelId: IDS.channel,
    createdBy: IDS.leader,
    name: "Discord 팀 데모",
    goal: "근거가 추적되는 역할 배정과 제출 ZIP 완성",
    deadline: "2026-08-15T18:00:00+09:00",
    doneState: "테스트 통과; 발표 자료와 데모 파일 준비",
  });
  await service.setMembers({
    guildId: IDS.guild,
    channelId: IDS.channel,
    changedBy: IDS.leader,
    actor: DEMO_ACTOR,
    members: [
      { id: IDS.memberA, displayName: "민지" },
      { id: IDS.memberB, displayName: "준호" },
    ],
  });
  await service.addTask({
    guildId: IDS.guild,
    channelId: IDS.channel,
    title: "발표 자료",
    weight: 1,
    requiredFiles: ["slides.txt"],
    lockedOwnerId: IDS.memberA,
    doneConditions: "내용 검토 완료",
    createdBy: IDS.leader,
    actor: DEMO_ACTOR,
  });
  await service.addTask({
    guildId: IDS.guild,
    channelId: IDS.channel,
    title: "Discord 데모",
    weight: 2,
    doneConditions: "실행 확인; 역할 배정 확인",
    createdBy: IDS.leader,
    actor: DEMO_ACTOR,
  });
  await service.captureEvidence({
    guildId: IDS.guild,
    channelId: IDS.channel,
    event: evidence({
      id: IDS.messageA,
      actor: "민지",
      authorId: IDS.memberA,
      text: "T-01 발표 자료는 @민지 제가 맡겠습니다.",
    }),
    actor: DEMO_ACTOR,
  });
  await service.captureEvidence({
    guildId: IDS.guild,
    channelId: IDS.channel,
    event: evidence({
      id: IDS.messageB,
      actor: "준호",
      authorId: IDS.memberB,
      text: "T-02 Discord 데모는 @준호 제가 맡겠습니다.",
    }),
    actor: DEMO_ACTOR,
  });

  let project = await service.proposeAssignments({
    guildId: IDS.guild,
    channelId: IDS.channel,
    requestedBy: IDS.leader,
    actor: DEMO_ACTOR,
  });
  project = await service.confirmAssignments({
    guildId: IDS.guild,
    channelId: IDS.channel,
    revision: project.revision,
    confirmedBy: IDS.leader,
    actor: DEMO_ACTOR,
  });

  const slidesPath = path.join(artifactDir, "slides.txt");
  await writeFile(slidesPath, "Demo slides verified\n", "utf8");
  await service.addArtifact({
    guildId: IDS.guild,
    channelId: IDS.channel,
    artifact: {
      id: "ART-DEMO-SLIDES",
      projectId: project.id,
      taskId: "T-01",
      filename: "slides.txt",
      version: "v1",
      mimeType: "text/plain",
      storagePath: slidesPath,
      sha256: await sha256File(slidesPath),
      source: `discord-attachment#${IDS.guild}/${IDS.channel}/150000000000000201`,
      status: "available",
    },
    actor: DEMO_ACTOR,
  });
  project = await service.requireProject(IDS.guild, IDS.channel);
  for (const task of project.tasks) {
    for (const checkpoint of task.checkpoints.filter((item) => item.evidenceKind !== "artifact")) {
      await service.recordCheckpoint({
        guildId: IDS.guild,
        channelId: IDS.channel,
        taskId: task.id,
        checkpointId: checkpoint.id,
        confirmedBy: IDS.leader,
        note: "오프라인 데모 확인",
        actor: DEMO_ACTOR,
      });
    }
  }

  const { progress } = await service.saveProgress({ guildId: IDS.guild, channelId: IDS.channel });
  const packaged = await service.createPackage({
    guildId: IDS.guild,
    channelId: IDS.channel,
    actor: DEMO_ACTOR,
  });
  const finalProject = await service.requireProject(IDS.guild, IDS.channel);
  const summary = {
    projectId: finalProject.id,
    assignmentState: finalProject.assignmentState,
    assignments: finalProject.assignments,
    progress,
    package: {
      zipPath: packaged.zipPath,
      zipSizeBytes: packaged.zipSizeBytes,
      zipSha256: packaged.zipSha256,
      manifestPath: packaged.manifestPath,
    },
  };
  const summaryPath = path.join(outputDir, "demo-result.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  logger.info(`Demo complete: ${progress.goalPercentage}%`);
  logger.info(`Result: ${summaryPath}`);
  logger.info(`Package: ${packaged.zipPath}`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDemo().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
