import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { messages } from "../messages";

const YTDLP_PATH = process.env.YTDLP_PATH ?? "yt-dlp";

export function buildYtDlpArgs(youtubeUrl: string): string[] {
  return [
    "-v", // 抽出フェーズのどこで時間がかかっているか本番ログから追えるようにする(診断目的)
    "--no-playlist",
    "-f",
    "bestaudio/best", // 音声専用ストリームが取れない場合のフォールバック(museを参考)
    "-S",
    "proto:https", // HLS/DASHマニフェスト形式より直接HTTPS配信を優先(マニフェスト取得の往復を避ける)
    "--js-runtimes",
    "node", // スタンドアロンバイナリでも動作確認済み。追加インストールなしでJS実行環境の警告を解消できる
    "-o",
    "-",
    youtubeUrl,
  ];
}

/**
 * yt-dlpを子プロセスとして起動し、音声データをstdout経由でストリームとして返す。
 * ffmpeg自身にHTTPS URLを直接フェッチさせるとこの環境ではセグフォルトするため
 * (ffmpeg-staticのgnutlsリンクの問題と見られる)、HTTPS取得はyt-dlpに任せ、
 * ffmpegにはローカルパイプ経由でのみデータを渡す。
 */
export function createYoutubeAudioStream(youtubeUrl: string, guildId: string): Readable {
  const child = spawn(YTDLP_PATH, buildYtDlpArgs(youtubeUrl), {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let receivedData = false;
  child.stdout.once("data", () => {
    receivedData = true;
    console.info(messages.introQuiz.audioStreamFirstChunk(guildId));
  });

  let stderrOutput = "";
  let stderrLineBuffer = "";
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrOutput += text;

    // -vの詳細ログを1行ずつログ出力する(各行にプラットフォーム側のタイムスタンプが付くため、
    // 抽出フェーズのどの段階で時間がかかっているか本番ログから追える)。
    // ダウンロード進捗行は\rのみで区切られ\nが来ないため、\rも改行として扱う
    stderrLineBuffer += text.replace(/\r/g, "\n");
    const lines = stderrLineBuffer.split("\n");
    stderrLineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.info(messages.introQuiz.ytdlpVerboseLog(guildId, line.trim()));
      }
    }
  });

  child.on("error", (error) => {
    const wrapped =
      "code" in error && error.code === "ENOENT"
        ? new Error(messages.introQuiz.ytdlpBinaryNotFound, { cause: error })
        : new Error(messages.introQuiz.ytdlpResolveFailed(youtubeUrl), { cause: error });
    child.stdout.destroy(wrapped);
  });

  child.on("exit", (code) => {
    if (!receivedData) {
      console.warn(messages.introQuiz.audioStreamExitedEarly(guildId, code));
    }
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
