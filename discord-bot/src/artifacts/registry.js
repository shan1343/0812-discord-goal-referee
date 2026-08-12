import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeFilename } from "../packaging/create-package.js";
import { assertSnowflakeString } from "../contracts.js";

function assertDiscordAttachmentUrl(value) {
  const url = new URL(value);
  const allowedHosts = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error("Only Discord-hosted HTTPS attachments are accepted");
  }
  return url;
}

export async function downloadArtifact({
  attachment,
  projectId,
  taskId,
  artifactDir,
  maxBytes = 20 * 1024 * 1024,
  fetchImpl = fetch,
}) {
  if (!attachment?.url || !attachment?.id) throw new Error("A Discord attachment is required");
  assertSnowflakeString(attachment.id, "attachment.id");
  const url = assertDiscordAttachmentUrl(attachment.url);
  if (Number(attachment.size) > maxBytes) throw new Error("Attachment exceeds the package size limit");
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (response.url) assertDiscordAttachmentUrl(response.url);
  if (!response.ok) throw new Error(`Could not download attachment (${response.status})`);
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Attachment exceeds the package size limit");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error("Attachment exceeds the package size limit");
  const dir = path.join(artifactDir, safeFilename(projectId));
  await mkdir(dir, { recursive: true });
  const filename = safeFilename(attachment.name || attachment.filename || `artifact-${attachment.id}`);
  const storagePath = path.join(dir, `${attachment.id}-${filename}`);
  await writeFile(storagePath, data);
  return {
    id: `ART-${attachment.id}`,
    projectId,
    taskId,
    filename,
    version: "1",
    mimeType: attachment.contentType || "application/octet-stream",
    sizeBytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    storagePath,
    source: `discord-attachment#${attachment.id}`,
    status: "available",
  };
}

export { assertDiscordAttachmentUrl };
