import { describe, expect, it, vi } from "vitest";
import { resolvePlaybackStartSeconds } from "./audio";
import type { QuizQuestion } from "./questionStore";

function baseQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: "q001",
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    startSeconds: 30,
    durationSeconds: 240,
    title: "曲名",
    artist: "アーティスト",
    answers: ["曲名"],
    ...overrides,
  };
}

describe("resolvePlaybackStartSeconds", () => {
  it("returns startSeconds as-is in intro mode", () => {
    const question = baseQuestion({ startSeconds: 42 });
    expect(resolvePlaybackStartSeconds(question, "intro", 8)).toBe(42);
  });

  it("returns a value within the head/tail buffer range in random mode", () => {
    const question = baseQuestion({ durationSeconds: 240 });
    for (let i = 0; i < 50; i += 1) {
      const start = resolvePlaybackStartSeconds(question, "random", 8);
      expect(start).toBeGreaterThanOrEqual(5);
      expect(start).toBeLessThan(240 - 8 - 10);
    }
  });

  it("falls back to startSeconds when the song is too short for the random range", () => {
    const question = baseQuestion({ startSeconds: 3, durationSeconds: 20 });
    expect(resolvePlaybackStartSeconds(question, "random", 8)).toBe(3);
  });

  it("resolves to the low end of the range when Math.random returns 0", () => {
    const question = baseQuestion({ durationSeconds: 240 });
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(resolvePlaybackStartSeconds(question, "random", 8)).toBe(5);
    spy.mockRestore();
  });
});
