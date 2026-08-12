import "../src/env.js";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const { DISCORD_APPLICATION_ID, DISCORD_GUILD_ID } = process.env;
const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
if (!discordToken || !DISCORD_APPLICATION_ID) throw new Error("DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID가 필요합니다.");

const commands = [new SlashCommandBuilder().setName("progress").setDescription("이 채널의 대화를 분석해 프로젝트 진행률을 표시합니다.").toJSON()];
const rest = new REST({ version: "10" }).setToken(discordToken);
const route = DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID)
  : Routes.applicationCommands(DISCORD_APPLICATION_ID);
await rest.put(route, { body: commands });
console.log(DISCORD_GUILD_ID ? "개발 서버 명령 등록 완료" : "전역 명령 등록 완료");
