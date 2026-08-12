import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";

const FIXED_DATE = new Date("2000-01-01T00:00:00.000Z");

export function safeFilename(value) {
  const base = path.basename(String(value || "file"));
  const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/^\.+/, "");
  return safe || "file";
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalJson(item)]),
    );
  }
  return value;
}

export async function buildManifest(project, artifacts = project.artifacts || []) {
  const files = [];
  for (const artifact of [...artifacts].sort((a, b) => a.id.localeCompare(b.id))) {
    const info = await stat(artifact.storagePath);
    const checksum = await sha256File(artifact.storagePath);
    if (artifact.sha256 && artifact.sha256 !== checksum) {
      throw new Error(`Artifact checksum mismatch: ${artifact.id}`);
    }
    files.push({
      id: artifact.id,
      taskId: artifact.taskId,
      filename: safeFilename(artifact.filename),
      version: artifact.version || "1",
      mimeType: artifact.mimeType || "application/octet-stream",
      sizeBytes: info.size,
      sha256: checksum,
      source: artifact.source || null,
      checkpointId: artifact.checkpointId || null,
    });
  }
  return canonicalJson({
    schemaVersion: 1,
    project: {
      id: project.id,
      name: project.name || null,
      guildId: project.guildId,
      channelId: project.channelId,
      goal: project.goal,
      revision: project.revision || 0,
    },
    tasks: (project.tasks || []).map((task) => ({
      id: task.id,
      title: task.title || task.text,
      weight: task.weight,
      ownerId: task.lockedOwnerId || null,
      deadline: task.deadline || null,
      dependencyIds: task.dependencyIds || [],
      checkpoints: task.checkpoints || [],
      source: task.source || null,
    })),
    members: (project.members || []).map((member) => ({
      id: member.id,
      displayName: member.displayName || member.display_name || null,
    })),
    assignments: (project.assignments || []).map((assignment) => ({
      taskId: assignment.taskId || assignment.task_id,
      ownerId: assignment.ownerId || assignment.owner_id || null,
      reason: assignment.reason,
      evidenceIds: assignment.evidenceIds || assignment.evidence_ids || [],
      confidence: assignment.confidence,
      blockers: assignment.blockers || [],
      alternativeOwnerId: assignment.alternativeOwnerId || assignment.alternative_owner_id || null,
      status: assignment.status,
      confirmationSource: assignment.confirmationSource || null,
    })),
    progress: project.progress || null,
    evidence: (project.evidence || []).map((event) => ({
      id: event.id,
      actor: event.actor || null,
      occurredAt: event.occurred_at || null,
      text: event.text,
      source: event.source,
    })),
    checkpointEvidence: (project.checkpointEvidence || []).map((item) => ({
      id: item.id,
      taskId: item.taskId || item.task_id,
      checkpointId: item.checkpointId || item.checkpoint_id,
      occurredAt: item.occurredAt || item.occurred_at || null,
      source: item.source || null,
    })),
    approvals: (project.approvals || []).map((item) => ({
      id: item.id,
      taskId: item.taskId || item.task_id || null,
      checkpointId: item.checkpointId || item.checkpoint_id || null,
      approved: item.approved !== false,
      source: item.source || null,
    })),
    files,
  });
}

export async function createProjectPackage({
  project,
  outputDir,
  maxBytes = 20 * 1024 * 1024,
}) {
  await mkdir(outputDir, { recursive: true });
  const manifest = await buildManifest(project);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestChecksum = sha256(Buffer.from(manifestText));
  const base = safeFilename(`team-readiness-${project.id}`);
  const manifestPath = path.join(outputDir, `${base}-manifest.json`);
  const zipPath = path.join(outputDir, `${base}.zip`);
  await writeFile(manifestPath, manifestText, "utf8");

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.append(manifestText, { name: "manifest.json", date: FIXED_DATE, mode: 0o644 });
    const usedNames = new Set();
    for (const artifact of [...(project.artifacts || [])].sort((a, b) => a.id.localeCompare(b.id))) {
      let name = safeFilename(artifact.filename);
      if (usedNames.has(name)) name = `${artifact.id}-${name}`;
      usedNames.add(name);
      archive.append(createReadStream(artifact.storagePath), { name: `artifacts/${name}`, date: FIXED_DATE, mode: 0o644 });
    }
    archive.finalize().catch(reject);
  });

  const zipInfo = await stat(zipPath);
  if (zipInfo.size > maxBytes) {
    await Promise.all([
      rm(zipPath, { force: true }),
      rm(manifestPath, { force: true }),
    ]);
    throw new Error(`Package exceeds Discord upload safety limit (${zipInfo.size} > ${maxBytes})`);
  }
  return {
    manifest,
    manifestPath,
    manifestChecksum,
    zipPath,
    zipSizeBytes: zipInfo.size,
    zipSha256: await sha256File(zipPath),
  };
}
