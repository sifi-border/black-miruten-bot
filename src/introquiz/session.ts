import type { Message, ThreadChannel, VoiceBasedChannel } from "discord.js";
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import { messages } from "../messages";
import { createYoutubeAudioResource, resolvePlaybackStartSeconds } from "./audio";
import { isCorrectAnswer } from "./judge";
import type { QuizQuestion } from "./questionStore";
import { buildScoreboardEmbed } from "./scoreboard";

export type QuizMode = "intro" | "random";

export interface GameSession {
  guildId: string;
  thread: ThreadChannel;
  voiceConnection: VoiceConnection;
  audioPlayer: AudioPlayer;
  mode: QuizMode;
  count: number;
  playSeconds: number;
  answerSeconds: number;
  pool: QuizQuestion[];
  usedQuestionIds: Set<string>;
  currentQuestion: QuizQuestion | null;
  currentCollector: ReturnType<ThreadChannel["createMessageCollector"]> | null;
  scores: Map<string, number>;
  completedCount: number;
  stopRequested: boolean;
  skipRequested: boolean;
}

interface StartSessionParams {
  thread: ThreadChannel;
  voiceChannel: VoiceBasedChannel;
  mode: QuizMode;
  count: number;
  playSeconds: number;
  answerSeconds: number;
  pool: QuizQuestion[];
}

const sessions = new Map<string, GameSession>();

// @discordjs/voiceのNetworkingStatusCode enumは公開APIとしてexportされていないため、
// 診断ログ表示用にローカルで名前対応表を持つ(OpeningWs=0, Identifying=1, UdpHandshaking=2,
// SelectingProtocol=3, Ready=4, Resuming=5, Closed=6の順)
const NETWORKING_STATUS_NAMES = [
  "OpeningWs",
  "Identifying",
  "UdpHandshaking",
  "SelectingProtocol",
  "Ready",
  "Resuming",
  "Closed",
] as const;

function networkingStatusName(code: number): string {
  return NETWORKING_STATUS_NAMES[code] ?? `unknown(${code})`;
}

const VOICE_READY_TIMEOUT_MS = 20_000;
const VOICE_RECONNECT_TIMEOUT_MS = 5_000;
const AUDIO_PLAYING_TIMEOUT_MS = 5_000;
const NEXT_QUESTION_DELAY_MS = 3_000;

export function getSession(guildId: string): GameSession | undefined {
  return sessions.get(guildId);
}

export function hasActiveSession(guildId: string): boolean {
  return sessions.has(guildId);
}

export async function startSession(params: StartSessionParams): Promise<GameSession> {
  const guildId = params.voiceChannel.guild.id;
  const voiceConnection = joinVoiceChannel({
    channelId: params.voiceChannel.id,
    guildId,
    adapterCreator: params.voiceChannel.guild.voiceAdapterCreator,
  });

  // Ready状態に到達しない場合の原因切り分け用(WebSocket/UDP経由のハンドシェイクがどこで止まっているか等)。
  // Networking(WebSocket/UDPの実際の通信を担う内部オブジェクト)のdebug/error/closeは
  // VoiceConnection側には自動転送されないため、state.networkingに直接listenする必要がある
  const attachedNetworkingInstances = new WeakSet<object>();

  voiceConnection.on("stateChange", (oldState, newState) => {
    console.info(
      messages.introQuiz.voiceConnectionStateChange(guildId, oldState.status, newState.status),
    );

    if (
      "networking" in newState &&
      newState.networking &&
      !attachedNetworkingInstances.has(newState.networking)
    ) {
      const networking = newState.networking;
      attachedNetworkingInstances.add(networking);

      networking.on("stateChange", (oldNetworkingState, newNetworkingState) => {
        console.info(
          messages.introQuiz.voiceNetworkingStateChange(
            guildId,
            networkingStatusName(oldNetworkingState.code),
            networkingStatusName(newNetworkingState.code),
          ),
        );
      });
      networking.on("debug", (message) => {
        console.debug(messages.introQuiz.voiceNetworkingDebug(guildId, message));
      });
      networking.on("error", (error) => {
        console.error(messages.introQuiz.voiceNetworkingError(guildId), error);
      });
      networking.on("close", (code) => {
        console.warn(messages.introQuiz.voiceNetworkingClosed(guildId, code));
      });
    }
  });
  voiceConnection.on("error", (error) => {
    console.error(messages.introQuiz.voiceConnectionError(guildId), error);
  });
  // stateChangeより詳細な内部ログ(WebSocketのclose code、UDP keep-aliveの失敗等が出ることがある)
  voiceConnection.on("debug", (message) => {
    console.debug(messages.introQuiz.voiceConnectionDebug(guildId, message));
  });

  try {
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
  } catch (error) {
    voiceConnection.destroy();
    throw error;
  }

  const audioPlayer = createAudioPlayer();
  voiceConnection.subscribe(audioPlayer);

  const session: GameSession = {
    guildId,
    thread: params.thread,
    voiceConnection,
    audioPlayer,
    mode: params.mode,
    count: params.count,
    playSeconds: params.playSeconds,
    answerSeconds: params.answerSeconds,
    pool: params.pool,
    usedQuestionIds: new Set(),
    currentQuestion: null,
    currentCollector: null,
    scores: new Map(),
    completedCount: 0,
    stopRequested: false,
    skipRequested: false,
  };

  voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
    void handleUnexpectedDisconnect(session);
  });

  sessions.set(guildId, session);
  return session;
}

async function handleUnexpectedDisconnect(session: GameSession): Promise<void> {
  try {
    // チャンネル移動などによる一時的な切断(誤検知)の可能性があるため、再接続を少し待つ
    await Promise.race([
      entersState(
        session.voiceConnection,
        VoiceConnectionStatus.Signalling,
        VOICE_RECONNECT_TIMEOUT_MS,
      ),
      entersState(
        session.voiceConnection,
        VoiceConnectionStatus.Connecting,
        VOICE_RECONNECT_TIMEOUT_MS,
      ),
    ]);
  } catch {
    if (!sessions.has(session.guildId)) return;

    session.stopRequested = true;
    session.currentCollector?.stop("disconnected");
    await session.thread.send(messages.introQuiz.voiceDisconnected).catch(() => undefined);
    endSession(session.guildId);
  }
}

export function requestSkip(session: GameSession): void {
  session.skipRequested = true;
  session.audioPlayer.stop();
  session.currentCollector?.stop("skip");
}

export function requestStop(session: GameSession): void {
  session.stopRequested = true;
  session.audioPlayer.stop();
  session.currentCollector?.stop("stop");
}

export function endSession(guildId: string): void {
  const session = sessions.get(guildId);
  if (!session) return;

  session.currentCollector?.stop();
  session.audioPlayer.stop();
  session.voiceConnection.destroy();
  sessions.delete(guildId);
}

function pickNextQuestion(session: GameSession): QuizQuestion | null {
  const remaining = session.pool.filter((question) => !session.usedQuestionIds.has(question.id));
  if (remaining.length === 0) return null;

  const question = remaining[Math.floor(Math.random() * remaining.length)];
  session.usedQuestionIds.add(question.id);
  return question;
}

async function playQuestion(session: GameSession, question: QuizQuestion): Promise<void> {
  const startSeconds = resolvePlaybackStartSeconds(question, session.mode, session.playSeconds);
  const resource = await createYoutubeAudioResource(question, startSeconds);
  session.audioPlayer.play(resource);
  await entersState(session.audioPlayer, AudioPlayerStatus.Playing, AUDIO_PLAYING_TIMEOUT_MS);

  const stopTimer = setTimeout(() => session.audioPlayer.stop(), session.playSeconds * 1000);
  try {
    await entersState(
      session.audioPlayer,
      AudioPlayerStatus.Idle,
      session.playSeconds * 1000 + AUDIO_PLAYING_TIMEOUT_MS,
    );
  } finally {
    clearTimeout(stopTimer);
  }
}

function waitForAnswer(session: GameSession, question: QuizQuestion): Promise<void> {
  return new Promise((resolve) => {
    const collector = session.thread.createMessageCollector({
      filter: (message) => !message.author.bot,
      time: session.answerSeconds * 1000,
    });
    session.currentCollector = collector;

    let correctUserId: string | null = null;

    collector.on("collect", (message: Message) => {
      if (correctUserId || !isCorrectAnswer(message.content, question.answers)) return;
      correctUserId = message.author.id;
      session.scores.set(correctUserId, (session.scores.get(correctUserId) ?? 0) + 1);
      collector.stop("correct");
    });

    collector.on("end", () => {
      session.currentCollector = null;
      void announceResult(session, question, correctUserId).then(resolve);
    });
  });
}

async function announceResult(
  session: GameSession,
  question: QuizQuestion,
  correctUserId: string | null,
): Promise<void> {
  const content = correctUserId
    ? messages.introQuiz.answerCorrect(correctUserId, question.title, question.artist)
    : messages.introQuiz.answerTimeout(question.title, question.artist);
  await session.thread.send(content).catch(() => undefined);
}

export async function runQuizLoop(session: GameSession): Promise<void> {
  try {
    for (let index = 0; index < session.count; index += 1) {
      if (session.stopRequested) break;

      const question = pickNextQuestion(session);
      if (!question) break;

      session.currentQuestion = question;
      session.skipRequested = false;

      await session.thread.send(
        messages.introQuiz.questionStart(index + 1, session.count, session.playSeconds),
      );
      await playQuestion(session, question);

      if (session.stopRequested) {
        session.currentQuestion = null;
        break;
      }

      if (session.skipRequested) {
        await announceResult(session, question, null);
      } else {
        await waitForAnswer(session, question);
      }
      session.currentQuestion = null;
      session.completedCount += 1;

      if (session.stopRequested) break;
      if (index < session.count - 1) {
        await new Promise((resolve) => setTimeout(resolve, NEXT_QUESTION_DELAY_MS));
      }
    }

    const embed = buildScoreboardEmbed(session.scores, messages.introQuiz.finalScoreboardTitle);
    await session.thread.send({ embeds: [embed] });
  } catch (error) {
    console.error(messages.introQuiz.unexpectedErrorLog(session.guildId), error);
    await session.thread.send(messages.introQuiz.unexpectedError).catch(() => undefined);
  } finally {
    await session.thread.setArchived(true).catch(() => undefined);
    await session.thread.setLocked(true).catch(() => undefined);
    endSession(session.guildId);
  }
}
