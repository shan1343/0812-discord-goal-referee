import { assertSnowflakeString, discordSource } from "../contracts.js";

function attachmentValues(attachments) {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments.values === "function") {
    return Array.from(attachments.values());
  }
  if (typeof attachments === "object") return Object.values(attachments);
  return [];
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;

  const id = attachment.id == null ? null : attachment.id;
  if (id !== null) assertSnowflakeString(id, "attachment.id");

  return {
    id,
    name: attachment.name ?? attachment.filename ?? null,
    content_type: attachment.contentType ?? attachment.content_type ?? null,
    size: Number.isSafeInteger(attachment.size) ? attachment.size : null,
  };
}

function occurredAt(message) {
  const value = message.createdAt ?? message.createdTimestamp ?? message.timestamp;
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("message creation time must be a valid date");
  }
  return date.toISOString();
}

function actorName(message) {
  const candidates = [
    message.member?.displayName,
    message.author?.globalName,
    message.author?.displayName,
    message.author?.username,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() ?? null;
}

function messageText(message, attachments) {
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (content) return content;

  const attachmentLabels = attachments.map((attachment) => {
    const label = attachment.name ?? attachment.id ?? "file";
    return `[attachment] ${label}`;
  });
  return attachmentLabels.join("\n");
}

function isDirectMessage(message, guildId) {
  if (!guildId) return true;
  if (typeof message.channel?.isDMBased !== "function") return false;
  return message.channel.isDMBased();
}

/**
 * Convert a discord.js Message-like value into the shared Event contract.
 * Messages outside a guild and messages authored by bots are intentionally
 * ignored so private conversations and bot loops never enter the project.
 */
export function normalizeDiscordMessage(message, { projectId } = {}) {
  if (!message || typeof message !== "object") {
    throw new TypeError("message must be an object");
  }

  const guildId = message.guildId ?? message.guild?.id ?? null;
  if (message.author?.bot === true || isDirectMessage(message, guildId)) return null;

  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new TypeError("projectId must be a non-empty string");
  }

  const messageId = message.id;
  const channelId = message.channelId ?? message.channel?.id;
  const authorId = message.author?.id ?? null;
  assertSnowflakeString(messageId, "message.id");
  assertSnowflakeString(guildId, "message.guildId");
  assertSnowflakeString(channelId, "message.channelId");
  if (authorId !== null) assertSnowflakeString(authorId, "message.author.id");

  const attachments = attachmentValues(message.attachments)
    .map(normalizeAttachment)
    .filter(Boolean);
  const text = messageText(message, attachments);
  if (!text) return null;

  return {
    id: messageId,
    projectId: projectId.trim(),
    source_type: "message",
    occurred_at: occurredAt(message),
    actor: actorName(message),
    text,
    source: discordSource(channelId, messageId),
    metadata: {
      guild_id: guildId,
      channel_id: channelId,
      message_id: messageId,
      author_id: authorId,
      attachments,
    },
  };
}
