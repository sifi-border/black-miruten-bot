import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./loadCommands";
import { messages } from "./messages";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

// カンマ区切りで複数ギルドIDを指定できる。未設定ならグローバル登録(反映まで最大1時間程度)を行う。
const guildIds = (process.env.DISCORD_GUILD_ID ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

if (!token) throw new Error(messages.env.missingDiscordToken);
if (!clientId) throw new Error(messages.env.missingDiscordClientId);

async function registerToGuilds(rest: REST, body: unknown[]): Promise<boolean> {
  const failedGuildIds: string[] = [];

  // Discord APIへの負荷・レート制限を避けるため、並列ではなく1件ずつ登録する。
  for (const guildId of guildIds) {
    console.log(messages.deploy.registeringToGuild(guildId));
    try {
      const data = (await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
        body,
      })) as unknown[];
      console.log(messages.deploy.registrationCompleteForGuild(data.length, guildId));
    } catch (error) {
      console.error(messages.deploy.registrationFailedForGuild(guildId), error);
      failedGuildIds.push(guildId);
    }
  }

  if (failedGuildIds.length > 0) {
    console.error(messages.deploy.registrationSummaryFailed(failedGuildIds.join(", ")));
    return false;
  }
  return true;
}

async function registerGlobally(rest: REST, body: unknown[]): Promise<boolean> {
  console.log(messages.deploy.registeringGlobally);
  try {
    const data = (await rest.put(Routes.applicationCommands(clientId!), { body })) as unknown[];
    console.log(messages.deploy.registrationComplete(data.length));
    return true;
  } catch (error) {
    console.error(messages.deploy.registrationFailed, error);
    return false;
  }
}

async function main() {
  const commands = loadCommands();
  const body = commands.map((command) => command.data.toJSON());
  console.log(messages.deploy.registrationTargets(commands.map((c) => c.data.name).join(", ")));

  const rest = new REST().setToken(token!);

  const succeeded =
    guildIds.length > 0 ? await registerToGuilds(rest, body) : await registerGlobally(rest, body);

  if (!succeeded) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(messages.deploy.registrationFailed, error);
  process.exit(1);
});
