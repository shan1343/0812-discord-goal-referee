import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

export function createDiscordClient({ config, handleInteraction, handleMessage, logger = console }) {
  const intents = [GatewayIntentBits.Guilds];
  if (config.discord.enableMessageContent) {
    intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  }

  const client = new Client({
    intents,
    partials: [Partials.Channel],
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Discord bot ready: ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (error) {
      logger.error("Interaction failed", error);
      const payload = { content: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => undefined);
      } else {
        await interaction.reply(payload).catch(() => undefined);
      }
    }
  });

  if (handleMessage) {
    client.on(Events.MessageCreate, async (message) => {
      try {
        await handleMessage(message);
      } catch (error) {
        logger.error("Live chat message failed", { message: error.message });
        await message.reply({
          content: "GPT 연결 중 오류가 발생했습니다. `/chat status`로 설정을 확인해 주세요.",
          allowedMentions: { repliedUser: false, parse: [] },
        }).catch(() => undefined);
      }
    });
  }

  return client;
}
