import { pathToFileURL } from "node:url";
import { createExtractor } from "../ai/extract.js";
import { createChatResponder } from "../ai/chat.js";
import { createDiscordClient } from "../discord/client.js";
import { createInteractionRouter } from "../discord/router.js";
import { createLiveChatHandler } from "../discord/live-chat.js";
import { ProjectStore } from "../storage/project-store.js";
import { assertLiveConfig, loadConfig, publicConfig } from "./config.js";
import { ProjectService } from "./project-service.js";

export async function startApp({ env = process.env, cwd = process.cwd(), logger = console } = {}) {
  const config = loadConfig(env, cwd);
  assertLiveConfig(config);
  if (config.ai.mode === "live" && !config.discord.enableMessageContent) {
    logger.warn("Live GPT is configured, but real-time Discord chat requires DISCORD_ENABLE_MESSAGE_CONTENT=true and the Developer Portal intent toggle.");
  }
  const store = new ProjectStore({ filePath: config.storage.databasePath });
  await store.init();
  const extractor = createExtractor({
    mode: config.ai.mode,
    apiKey: config.ai.apiKey,
    model: config.ai.model,
  });
  const service = new ProjectService({ store, extractor, config });
  const chatResponder = createChatResponder({
    mode: config.ai.mode,
    apiKey: config.ai.apiKey,
    model: config.ai.model,
    maxOutputTokens: config.ai.maxOutputTokens,
    timeoutMs: config.ai.timeoutMs,
  });
  const handleInteraction = createInteractionRouter({ service, config, chatResponder, logger });
  const handleMessage = createLiveChatHandler({ service, responder: chatResponder, config, logger });
  const client = createDiscordClient({ config, handleInteraction, handleMessage, logger });
  await client.login(config.discord.token);
  logger.info("Configuration", publicConfig(config));
  return { chatResponder, client, config, extractor, handleInteraction, handleMessage, service, store };
}

const isCli = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  startApp().then(({ client }) => {
    const close = async () => {
      client.destroy();
      process.exitCode = 0;
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
