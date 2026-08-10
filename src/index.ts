import "dotenv/config";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import { startHealthServer } from "./health";
import { loadCommands } from "./loadCommands";
import { messages } from "./messages";
import type { SlashCommand } from "./types";

startHealthServer();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error(messages.env.missingDiscordToken);
}

const commands = new Collection<string, SlashCommand>();
for (const command of loadCommands()) {
  commands.set(command.data.name, command);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  console.info(
    messages.interactionReceived.log(
      interaction.commandName,
      interaction.user.tag,
      interaction.guildId,
    ),
  );

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(messages.interactionError.log(interaction.commandName), error);
    const errorReply = {
      content: messages.interactionError.reply,
      ephemeral: true,
    } as const;

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    } catch (replyError) {
      // エラー内容の返信自体が失敗しても(二重応答等)プロセス全体を落とさない
      console.error(messages.interactionError.replyFailedLog(interaction.commandName), replyError);
    }
  }
});

client.on(Events.Error, (error) => {
  console.error(messages.clientError.log, error);
});

client.login(token);
