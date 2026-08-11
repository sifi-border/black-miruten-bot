import { describe, expect, it } from "vitest";
import { buildYtDlpArgs } from "./youtubeResolver";

describe("buildYtDlpArgs", () => {
  it("builds args to pipe the best audio stream to stdout without playlist expansion", () => {
    expect(buildYtDlpArgs("https://www.youtube.com/watch?v=abc")).toEqual([
      "-v",
      "--no-playlist",
      "-f",
      "bestaudio/best",
      "-S",
      "proto:https",
      "--js-runtimes",
      "node",
      "-o",
      "-",
      "https://www.youtube.com/watch?v=abc",
    ]);
  });
});
