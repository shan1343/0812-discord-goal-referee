export const TASK_STATES = [
  "not_started",
  "in_progress",
  "review_pending",
  "blocked",
  "done",
  "unknown",
];

export const ASSIGNMENT_STATES = ["proposed", "needs_input", "confirmed"];

export function projectKey(guildId, channelId) {
  if (!guildId || !channelId) throw new Error("guildId and channelId are required");
  return `${guildId}:${channelId}`;
}

export function discordSource(channelId, messageId) {
  return `discord-message#${channelId}/${messageId}`;
}

export function assertSnowflakeString(value, name) {
  if (typeof value !== "string" || !/^\d{5,25}$/.test(value)) {
    throw new TypeError(`${name} must be a Discord ID string`);
  }
}

export function nowIso(clock = () => new Date()) {
  return clock().toISOString();
}
