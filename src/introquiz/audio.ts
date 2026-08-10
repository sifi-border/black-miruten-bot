import { createAudioResource, type AudioResource } from "@discordjs/voice";
import ffmpegPath from "ffmpeg-static";
import play from "play-dl";
import type { QuizQuestion } from "./questionStore";

// prism-media(@discordjs/voiceが内部で使用)のffmpeg探索を明示的に補強する
if (ffmpegPath && !process.env.FFMPEG_PATH) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

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
): Promise<AudioResource> {
  const source = await play.stream(question.youtubeUrl, { seek: startSeconds });
  return createAudioResource(source.stream, { inputType: source.type });
}
