import { readdirSync } from "node:fs";
import path from "node:path";
import { messages } from "./messages";
import type { SlashCommand } from "./types";

const COMMANDS_DIR = path.join(__dirname, "commands");
const COMMAND_FILE_PATTERN = /\.(ts|js)$/;

function isSlashCommand(value: unknown): value is SlashCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "execute" in value
  );
}

/**
 * commands/ ディレクトリ配下のファイルを走査し、
 * `export default { data, execute }` 形式のコマンドを収集する。
 * commands/ にファイルを追加するだけで index.ts / deploy-commands.ts の
 * 修正なしに読み込まれるようにするための仕組み。
 */
export function loadCommands(): SlashCommand[] {
  const files = readdirSync(COMMANDS_DIR).filter(
    (file) => COMMAND_FILE_PATTERN.test(file) && !file.endsWith(".d.ts"),
  );

  const commands: SlashCommand[] = [];
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const imported = require(path.join(COMMANDS_DIR, file));
    const command: unknown = imported.default ?? imported;

    if (!isSlashCommand(command)) {
      console.warn(messages.loadCommands.invalidCommandWarning(file));
      continue;
    }

    commands.push(command);
  }

  return commands;
}
