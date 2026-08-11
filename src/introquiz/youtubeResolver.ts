import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { messages } from "../messages";

const YTDLP_PATH = process.env.YTDLP_PATH ?? "yt-dlp";

export function buildYtDlpArgs(youtubeUrl: string): string[] {
  return ["--no-playlist", "-f", "bestaudio", "-o", "-", youtubeUrl];
}

/**
 * yt-dlpを子プロセスとして起動し、音声データをstdout経由でストリームとして返す。
 * ffmpeg自身にHTTPS URLを直接フェッチさせるとこの環境ではセグフォルトするため
 * (ffmpeg-staticのgnutlsリンクの問題と見られる)、HTTPS取得はyt-dlpに任せ、
 * ffmpegにはローカルパイプ経由でのみデータを渡す。
 */
export function createYoutubeAudioStream(youtubeUrl: string): Readable {
  const child = spawn(YTDLP_PATH, buildYtDlpArgs(youtubeUrl), {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderrOutput = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrOutput += chunk.toString();
  });

  child.on("error", (error) => {
    const wrapped =
      "code" in error && error.code === "ENOENT"
        ? new Error(messages.introQuiz.ytdlpBinaryNotFound, { cause: error })
        : new Error(messages.introQuiz.ytdlpResolveFailed(youtubeUrl), { cause: error });
    child.stdout.destroy(wrapped);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      child.stdout.destroy(
        new Error(messages.introQuiz.ytdlpResolveFailed(youtubeUrl), {
          cause: new Error(stderrOutput.trim() || `yt-dlp exited with code ${code}`),
        }),
      );
    }
  });

  return child.stdout;
}
