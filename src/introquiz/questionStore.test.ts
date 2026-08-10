import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addQuestion,
  getQuestionById,
  loadAllQuestions,
  removeQuestion,
  updateQuestion,
  type QuizQuestion,
} from "./questionStore";

const originalDataPath = process.env.QUIZ_DATA_PATH;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "quiz-questions-"));
  process.env.QUIZ_DATA_PATH = path.join(tempDir, "quiz-questions.json");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  process.env.QUIZ_DATA_PATH = originalDataPath;
});

function baseInput(): Omit<QuizQuestion, "id"> {
  return {
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    startSeconds: 10,
    durationSeconds: 200,
    title: "曲名",
    artist: "アーティスト",
    answers: ["曲名"],
  };
}

describe("questionStore", () => {
  it("starts empty and creates the file on first read", async () => {
    expect(await loadAllQuestions()).toEqual([]);
  });

  it("adds a question with an auto-numbered id", async () => {
    const first = await addQuestion(baseInput());
    const second = await addQuestion(baseInput());
    expect(first.id).toBe("q001");
    expect(second.id).toBe("q002");
    expect(await loadAllQuestions()).toHaveLength(2);
  });

  it("numbers new ids based on the current max, reusing a gap left by removal", async () => {
    await addQuestion(baseInput());
    const second = await addQuestion(baseInput());
    await removeQuestion(second.id);
    const third = await addQuestion(baseInput());
    expect(third.id).toBe("q002");
  });

  it("pads to 3 digits without truncating at double digits", async () => {
    for (let i = 0; i < 9; i += 1) {
      await addQuestion(baseInput());
    }
    const tenth = await addQuestion(baseInput());
    expect(tenth.id).toBe("q010");
  });

  it("updates only the provided fields", async () => {
    const question = await addQuestion(baseInput());
    const updated = await updateQuestion(question.id, { title: "新しい曲名" });
    expect(updated?.title).toBe("新しい曲名");
    expect(updated?.artist).toBe(question.artist);
  });

  it("returns null when updating a missing id", async () => {
    expect(await updateQuestion("q999", { title: "x" })).toBeNull();
  });

  it("removes a question and reports whether it existed", async () => {
    const question = await addQuestion(baseInput());
    expect(await removeQuestion(question.id)).toBe(true);
    expect(await removeQuestion(question.id)).toBe(false);
  });

  it("finds a question by id, or returns null", async () => {
    const question = await addQuestion(baseInput());
    expect((await getQuestionById(question.id))?.id).toBe(question.id);
    expect(await getQuestionById("q999")).toBeNull();
  });
});
