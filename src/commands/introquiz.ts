import {
  ChannelType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { loadAllQuestions } from "../introquiz/questionStore";
import { buildScoreboardEmbed } from "../introquiz/scoreboard";
import {
  getSession,
  hasActiveSession,
  requestSkip,
  requestStop,
  runQuizLoop,
  startSession,
  type QuizMode,
} from "../introquiz/session";
import { messages } from "../messages";
import type { SlashCommand } from "../types";

const DEFAULT_COUNT = 5;
const DEFAULT_PLAY_SECONDS = 8;
const DEFAULT_ANSWER_SECONDS = 15;
const DEFAULT_MODE: QuizMode = "intro";

const data = new SlashCommandBuilder()
  .setName("introquiz")
  .setDescription(messages.introQuiz.commandDescription)
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription(messages.introQuiz.startDescription)
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription(messages.introQuiz.countOptionDescription)
          .setMinValue(1),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("play-seconds")
          .setDescription(messages.introQuiz.playSecondsOptionDescription)
          .setMinValue(1),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("answer-seconds")
          .setDescription(messages.introQuiz.answerSecondsOptionDescription)
          .setMinValue(1),
      )
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription(messages.introQuiz.modeOptionDescription)
          .addChoices(
            { name: messages.introQuiz.modeChoiceIntro, value: "intro" },
            { name: messages.introQuiz.modeChoiceRandom, value: "random" },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName("skip").setDescription(messages.introQuiz.skipDescription))
  .addSubcommand((sub) => sub.setName("stop").setDescription(messages.introQuiz.stopDescription))
  .addSubcommand((sub) =>
    sub.setName("score").setDescription(messages.introQuiz.scoreDescription),
  ) as SlashCommandBuilder;

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: messages.introQuiz.guildOnly, ephemeral: true });
    return;
  }

  if (!interaction.channel || interaction.channel.isThread()) {
    await interaction.reply({
      content: messages.introQuiz.mustRunInNormalChannel,
      ephemeral: true,
    });
    return;
  }

  // ギルド内のインタラクションはゲートウェイキャッシュから完全なGuildMemberが渡される
  const member = interaction.member as GuildMember | null;
  const voiceChannel = member?.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: messages.introQuiz.mustBeInVoiceChannel, ephemeral: true });
    return;
  }

  if (hasActiveSession(guildId)) {
    await interaction.reply({ content: messages.introQuiz.sessionAlreadyActive, ephemeral: true });
    return;
  }

  const allQuestions = await loadAllQuestions();
  if (allQuestions.length === 0) {
    await interaction.reply({ content: messages.introQuiz.emptyQuestionPool, ephemeral: true });
    return;
  }

  const requestedCount = interaction.options.getInteger("count") ?? DEFAULT_COUNT;
  const count = Math.max(1, Math.min(requestedCount, allQuestions.length));
  const playSeconds = interaction.options.getInteger("play-seconds") ?? DEFAULT_PLAY_SECONDS;
  const answerSeconds = interaction.options.getInteger("answer-seconds") ?? DEFAULT_ANSWER_SECONDS;
  const mode = (interaction.options.getString("mode") as QuizMode | null) ?? DEFAULT_MODE;

  // スレッド作成・VC接続は3秒のインタラクション応答期限を超えうるためdeferする
  await interaction.deferReply();

  const channel = interaction.channel as TextChannel;
  const startedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const thread = await channel.threads
    .create({
      name: messages.introQuiz.threadName(startedAt),
      type: ChannelType.PublicThread,
      reason: messages.introQuiz.threadCreateReason,
    })
    .catch((error: unknown) => {
      console.error(messages.introQuiz.threadCreateFailed, error);
      return null;
    });
  if (!thread) {
    await interaction.editReply(messages.introQuiz.threadCreateFailed);
    return;
  }

  const session = await startSession({
    thread,
    voiceChannel,
    mode,
    count,
    playSeconds,
    answerSeconds,
    pool: allQuestions,
  }).catch((error: unknown) => {
    console.error(messages.introQuiz.voiceJoinFailed, error);
    return null;
  });
  if (!session) {
    await thread.delete().catch(() => undefined);
    await interaction.editReply(messages.introQuiz.voiceJoinFailed);
    return;
  }

  const clampNote =
    count < requestedCount ? `\n${messages.introQuiz.startedWithClampedCount(count)}` : "";
  await interaction.editReply(`${messages.introQuiz.startReply(thread.toString())}${clampNote}`);

  // ゲームはコマンド応答後も数分継続するためawaitせずに発火し、失敗はここで確実に捕捉する
  runQuizLoop(session).catch((error: unknown) => {
    console.error(messages.introQuiz.unexpectedErrorLog(guildId), error);
  });
}

async function handleSkip(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = interaction.guildId ? getSession(interaction.guildId) : undefined;
  if (!session) {
    await interaction.reply({ content: messages.introQuiz.noActiveSession, ephemeral: true });
    return;
  }
  requestSkip(session);
  await interaction.reply(messages.introQuiz.skipped);
}

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = interaction.guildId ? getSession(interaction.guildId) : undefined;
  if (!session) {
    await interaction.reply({ content: messages.introQuiz.noActiveSession, ephemeral: true });
    return;
  }
  requestStop(session);
  await interaction.reply(messages.introQuiz.stopAccepted);
}

async function handleScore(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = interaction.guildId ? getSession(interaction.guildId) : undefined;
  if (!session) {
    await interaction.reply({ content: messages.introQuiz.noActiveSession, ephemeral: true });
    return;
  }
  const embed = buildScoreboardEmbed(
    session.scores,
    messages.introQuiz.scoreboardTitle(session.completedCount, session.count),
  );
  await interaction.reply({ embeds: [embed] });
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "start":
      await handleStart(interaction);
      return;
    case "skip":
      await handleSkip(interaction);
      return;
    case "stop":
      await handleStop(interaction);
      return;
    case "score":
      await handleScore(interaction);
      return;
  }
}

export default { data, execute } satisfies SlashCommand;
