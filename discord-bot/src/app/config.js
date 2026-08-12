import path from "node:path";

function bool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env = process.env, cwd = process.cwd()) {
  return {
    discord: {
      token: env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN || "",
      applicationId: env.DISCORD_APPLICATION_ID || env.DISCORD_CLIENT_ID || "",
      guildId: env.DISCORD_GUILD_ID || "",
      commandScope: env.DISCORD_COMMAND_SCOPE || "guild",
      enableMessageContent: bool(env.DISCORD_ENABLE_MESSAGE_CONTENT),
    },
    ai: {
      mode: env.AI_MODE || "mock",
      apiKey: env.OPENAI_API_KEY || "",
      model: env.OPENAI_MODEL || "gpt-5-mini",
      maxOutputTokens: integer(env.OPENAI_MAX_OUTPUT_TOKENS, 800),
      timeoutMs: integer(env.OPENAI_TIMEOUT_MS, 30_000),
    },
    liveChat: {
      maxHistory: Math.min(Math.max(integer(env.LIVE_CHAT_MAX_HISTORY, 20), 1), 50),
      cooldownMs: Math.max(integer(env.LIVE_CHAT_COOLDOWN_MS, 1_000), 0),
      showDiagnostics: bool(env.LIVE_CHAT_SHOW_DIAGNOSTICS, true),
    },
    storage: {
      databasePath: path.resolve(cwd, env.DATABASE_PATH || "./data/projects.json"),
      artifactDir: path.resolve(cwd, env.ARTIFACT_DIR || "./data/artifacts"),
      maxPackageBytes: integer(env.MAX_PACKAGE_BYTES, 20 * 1024 * 1024),
    },
    dashboard: {
      apiBaseUrl: String(env.GOAL_REFEREE_API_URL || "").replace(/\/$/, ""),
      ingestToken: env.GOAL_REFEREE_INGEST_TOKEN || "",
      webBaseUrl: String(env.WEB_BASE_URL || "").replace(/\/$/, ""),
    },
    timeZone: env.TIME_ZONE || "Asia/Seoul",
  };
}

export function assertLiveConfig(config) {
  const missing = [];
  if (!config.discord.token) missing.push("DISCORD_BOT_TOKEN");
  if (!config.discord.applicationId) missing.push("DISCORD_APPLICATION_ID");
  if (config.discord.commandScope === "guild" && !config.discord.guildId) {
    missing.push("DISCORD_GUILD_ID");
  }
  if (config.ai.mode === "live" && !config.ai.apiKey) missing.push("OPENAI_API_KEY");
  if (config.dashboard.apiBaseUrl && !config.dashboard.ingestToken) {
    missing.push("GOAL_REFEREE_INGEST_TOKEN");
  }
  if (missing.length) {
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }
}

export function publicConfig(config) {
  return {
    commandScope: config.discord.commandScope,
    guildConfigured: Boolean(config.discord.guildId),
    messageContentEnabled: config.discord.enableMessageContent,
    aiMode: config.ai.mode,
    model: config.ai.model,
    liveChatMaxHistory: config.liveChat.maxHistory,
    maxPackageBytes: config.storage.maxPackageBytes,
    dashboardSyncConfigured: Boolean(config.dashboard.apiBaseUrl),
  };
}
