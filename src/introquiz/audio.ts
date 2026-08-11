import { createAudioResource, StreamType, type AudioResource } from "@discordjs/voice";
import { FFmpeg } from "prism-media";
import { messages } from "../messages";
import type { QuizQuestion } from "./questionStore";
import { createYoutubeAudioStream } from "./youtubeResolver";

const HEAD_BUFFER_SECONDS = 5; // 曲の最初は無音・イントロ被りを避けるため除外
const TAIL_BUFFER_SECONDS = 10; // 曲の最後はフェードアウト等を避けるため除外

export function resolvePlaybackStartSeconds(
  question: QuizQuestion,
  mode: "intro" | "random",
  playSeconds: number,
): number {
  if (mode === "intro") {
    return question.startSeconds;
  }

  const minStart = HEAD_BUFFER_SECONDS;
  const maxStart = question.durationSeconds - playSeconds - TAIL_BUFFER_SECONDS;
  if (maxStart <= minStart) {
    // 曲が短すぎてランダム範囲を確保できない場合はイントロ位置にフォールバック
    return question.startSeconds;
  }

  return minStart + Math.floor(Math.random() * (maxStart - minStart));
}

export async function createYoutubeAudioResource(
  question: QuizQuestion,
  startSeconds: number,
  guildId: string,
): Promise<AudioResource> {
  const youtubeStream = createYoutubeAudioStream(question.youtubeUrl, guildId);

  // ffmpegにHTTPS URLを直接開かせるとこの環境ではセグフォルトするため、
  // 標準入力(ローカルパイプ)経由でのみデータを渡す。-ssは非シーク可能な
  // 入力に対しては先頭からデコードして読み捨てる形になる(低速だが正しく動作する)。
  const transcoder = new FFmpeg({
    args: [
      "-ss",
      String(startSeconds),
      "-i",
      "pipe:0",
      "-analyzeduration",
      "0",
      "-loglevel",
      "0",
      "-acodec",
      "libopus",
      "-f",
      "opus",
      "-ar",
      "48000",
      "-ac",
      "2",
    ],
  });

  transcoder.once("data", () => {
    console.info(messages.introQuiz.transcoderFirstChunk(guildId));
  });

  // pipe()はソース側の'error'を自動転送しないため、明示的に転送する
  youtubeStream.on("error", (error) => transcoder.destroy(error));
  youtubeStream.pipe(transcoder);

  return createAudioResource(transcoder, { inputType: StreamType.OggOpus });
}
