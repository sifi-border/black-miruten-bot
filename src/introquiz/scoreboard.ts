import { EmbedBuilder } from "discord.js";
import { messages } from "../messages";

const SCOREBOARD_COLOR = 0x5865f2;

export function buildScoreboardEmbed(scores: Map<string, number>, title: string): EmbedBuilder {
  const sorted = [...scores.entries()].sort(([, a], [, b]) => b - a);
  const description = sorted.length
    ? sorted
        .map(([userId, score], index) =>
          messages.introQuiz.scoreboardLine(index + 1, userId, score),
        )
        .join("\n")
    : messages.introQuiz.scoreboardEmpty;

  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(SCOREBOARD_COLOR);
}
