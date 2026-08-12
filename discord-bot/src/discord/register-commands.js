import { pathToFileURL } from "node:url";
import { REST, Routes } from "discord.js";
import { loadConfig, assertLiveConfig } from "../app/config.js";
import { buildCommands } from "./commands.js";

export async function registerCommands({ config, rest } = {}) {
  const resolvedConfig = config || loadConfig();
  assertLiveConfig({
    ...resolvedConfig,
    ai: { ...resolvedConfig.ai, mode: "mock" },
  });
  const client = rest || new REST({ version: "10" }).setToken(resolvedConfig.discord.token);
  const body = buildCommands();
  const route = resolvedConfig.discord.commandScope === "global"
    ? Routes.applicationCommands(resolvedConfig.discord.applicationId)
    : Routes.applicationGuildCommands(
        resolvedConfig.discord.applicationId,
        resolvedConfig.discord.guildId,
      );
  await client.put(route, { body });
  return { count: body.length, scope: resolvedConfig.discord.commandScope };
}
const isCli = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  registerCommands()
    .then(({ count, scope }) => console.info(`${count}개 명령을 ${scope} 범위에 등록했습니다.`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
