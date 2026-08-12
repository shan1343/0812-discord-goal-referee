import "./env.js";
import { Client, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { normalizeConversation } from "./conversation.js";
import { analyzeProgress } from "./progress.js";
import { createDashboard, detailContent } from "./dashboard.js";

const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
if (!discordToken) throw new Error("DISCORD_BOT_TOKEN이 없습니다. 루트 .env를 설정하세요.");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

async function reportFor(channel) {
  if (!channel?.isTextBased?.()) throw new Error("텍스트 채널에서만 사용할 수 있습니다.");
  const collection = await channel.messages.fetch({ limit: 100 });
  const source = [...collection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const messages = normalizeConversation(source);
  return analyzeProgress(messages);
}

async function replyWithProgress(interaction) {
  const report = await reportFor(interaction.channel);
  return interaction.editReply(await createDashboard(report, { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }));
}

client.once(Events.ClientReady, (ready) => console.log(`GoalReferee ready: ${ready.user.tag}`));

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "progress") {
      await interaction.deferReply();
      await replyWithProgress(interaction);
      return;
    }
    if (!interaction.isButton()) return;
    if (interaction.customId === "progress:refresh") {
      await interaction.deferUpdate();
      const report = await reportFor(interaction.channel);
      await interaction.editReply(await createDashboard(report, { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }));
      return;
    }
    if (interaction.customId === "progress:details") {
      await interaction.deferReply({ ephemeral: true });
      const report = await reportFor(interaction.channel);
      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("👥 개인별 진행 상세").addFields(detailContent(report));
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error(error);
    const message = "진행률을 만들지 못했어요. API 키, 봇 권한, 채널 메시지 접근 권한을 확인해 주세요.";
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message, embeds: [], components: [] });
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

client.login(discordToken);
