import { existsSync } from "node:fs";
import path from "node:path";
import { AttachmentBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { buildBubbleText } from "../utils/bubble";
import { DEFAULT_IMAGE_ID, getImageById, resolveImageAbsolutePath } from "../config/images";
import { messages } from "../messages";
import type { SlashCommand } from "../types";

// Discordのメッセージ本文の上限
const DISCORD_CONTENT_LIMIT = 2000;
// コマンド引数として受け付ける最大文字数(端末の暴走的な入力を防ぐための実装側の判断)
const MESSAGE_OPTION_MAX_LENGTH = 500;

const data = new SlashCommandBuilder()
  .setName("miruten-say")
  .setDescription(messages.mirutenSay.commandDescription)
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription(messages.mirutenSay.messageOptionDescription)
      .setRequired(true)
      .setMaxLength(MESSAGE_OPTION_MAX_LENGTH),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction) {
  const message = interaction.options.getString("message", true);
  const content = buildBubbleText(message);

  if (content.length > DISCORD_CONTENT_LIMIT) {
    await interaction.reply({
      content: messages.mirutenSay.messageTooLong,
      ephemeral: true,
    });
    return;
  }

  const image = getImageById(DEFAULT_IMAGE_ID);
  const absolutePath = image ? resolveImageAbsolutePath(image) : undefined;

  if (!image || !absolutePath || !existsSync(absolutePath)) {
    console.error(messages.mirutenSay.imageLoadErrorLog(absolutePath ?? DEFAULT_IMAGE_ID));
    await interaction.reply({
      content: messages.mirutenSay.imageLoadErrorReply,
      ephemeral: true,
    });
    return;
  }

  const attachment = new AttachmentBuilder(absolutePath, { name: path.basename(absolutePath) });
  await interaction.reply({ content, files: [attachment] });
}

export default { data, execute } satisfies SlashCommand;
