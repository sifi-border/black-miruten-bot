import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./loadCommands";
import { messages } from "./messages";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) throw new Error(messages.env.missingDiscordToken);
if (!clientId) throw new Error(messages.env.missingDiscordClientId);

async function main() {
  const commands = loadCommands();
  const body = commands.map((command) => command.data.toJSON());

  const rest = new REST().setToken(token!);

  // GUILD_IDが指定されていればギルド限定登録(反映が速く開発向き)、
  // 未指定ならグローバル登録(反映まで最大1時間程度かかる)を行う。
  const route = guildId
    ? Routes.applicationGuildCommands(clientId!, guildId)
    : Routes.applicationCommands(clientId!);

  console.log(
    guildId ? messages.deploy.registeringToGuild(guildId) : messages.deploy.registeringGlobally,
  );
  console.log(messages.deploy.registrationTargets(commands.map((c) => c.data.name).join(", ")));

  const data = (await rest.put(route, { body })) as unknown[];
  console.log(messages.deploy.registrationComplete(data.length));
}

main().catch((error) => {
  console.error(messages.deploy.registrationFailed, error);
  process.exit(1);
});
