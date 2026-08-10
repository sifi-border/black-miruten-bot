import { beforeEach, describe, expect, it } from "vitest";
import { computeNextId, createQuestionStore } from "./questionStore";
import type { QuestionRepository, QuizQuestion } from "./questionRepository";

class InMemoryQuestionRepository implements QuestionRepository {
  private questions: QuizQuestion[] = [];

  async findByGuildId(guildId: string): Promise<QuizQuestion[]> {
    return this.questions.filter((question) => question.guildId === guildId);
  }

  async findAllIds(): Promise<string[]> {
    return this.questions.map((question) => question.id);
  }

  async insert(question: QuizQuestion): Promise<void> {
    this.questions.push(question);
  }

  async findById(id: string): Promise<QuizQuestion | null> {
    return this.questions.find((question) => question.id === id) ?? null;
  }

  async updateById(id: string, patch: Partial<Omit<QuizQuestion, "id">>): Promise<boolean> {
    const index = this.questions.findIndex((question) => question.id === id);
    if (index === -1) return false;
    this.questions[index] = { ...this.questions[index], ...patch };
    return true;
  }

  async deleteById(id: string): Promise<boolean> {
    const before = this.questions.length;
    this.questions = this.questions.filter((question) => question.id !== id);
    return this.questions.length < before;
  }

  async close(): Promise<void> {}
}

describe("computeNextId", () => {
  it("starts at q001 when there are no existing ids", () => {
    expect(computeNextId([])).toBe("q001");
  });

  it("returns the max existing numeric id + 1", () => {
    expect(computeNextId(["q001", "q002"])).toBe("q003");
  });

  it("is based on the current max, so a gap left by removal gets reused", () => {
    expect(computeNextId(["q001"])).toBe("q002");
  });

  it("pads to 3 digits without truncating at double digits", () => {
    expect(computeNextId(["q009"])).toBe("q010");
  });

  it("ignores ids that don't match the qNNN format", () => {
    expect(computeNextId(["not-an-id", "q005"])).toBe("q006");
  });
});

const GUILD_A = "guild-a";
const GUILD_B = "guild-b";

function baseInput(guildId: string = GUILD_A): Omit<QuizQuestion, "id"> {
  return {
    guildId,
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    startSeconds: 10,
    durationSeconds: 200,
    title: "曲名",
    artist: "アーティスト",
    answers: ["曲名"],
  };
}

describe("questionStore (against an in-memory repository)", () => {
  let store: ReturnType<typeof createQuestionStore>;

  beforeEach(() => {
    store = createQuestionStore(new InMemoryQuestionRepository());
  });

  it("starts empty", async () => {
    expect(await store.loadQuestionsByGuild(GUILD_A)).toEqual([]);
  });

  it("adds a question with an auto-numbered id", async () => {
    const first = await store.addQuestion(baseInput());
    const second = await store.addQuestion(baseInput());
    expect(first.id).toBe("q001");
    expect(second.id).toBe("q002");
    expect(await store.loadQuestionsByGuild(GUILD_A)).toHaveLength(2);
  });

  it("only returns questions belonging to the requested guild", async () => {
    await store.addQuestion(baseInput(GUILD_A));
    await store.addQuestion(baseInput(GUILD_B));
    await store.addQuestion(baseInput(GUILD_A));

    expect(await store.loadQuestionsByGuild(GUILD_A)).toHaveLength(2);
    expect(await store.loadQuestionsByGuild(GUILD_B)).toHaveLength(1);
    expect(await store.loadQuestionsByGuild("guild-with-no-questions")).toEqual([]);
  });

  it("keeps id numbering global across guilds", async () => {
    const first = await store.addQuestion(baseInput(GUILD_A));
    const second = await store.addQuestion(baseInput(GUILD_B));
    expect(first.id).toBe("q001");
    expect(second.id).toBe("q002");
  });

  it("numbers new ids based on the current max, reusing a gap left by removal", async () => {
    await store.addQuestion(baseInput());
    const second = await store.addQuestion(baseInput());
    await store.removeQuestion(second.id);
    const third = await store.addQuestion(baseInput());
    expect(third.id).toBe("q002");
  });

  it("updates only the provided fields", async () => {
    const question = await store.addQuestion(baseInput());
    const updated = await store.updateQuestion(question.id, { title: "新しい曲名" });
    expect(updated?.title).toBe("新しい曲名");
    expect(updated?.artist).toBe(question.artist);
  });

  it("returns null when updating a missing id", async () => {
    expect(await store.updateQuestion("q999", { title: "x" })).toBeNull();
  });

  it("removes a question and reports whether it existed", async () => {
    const question = await store.addQuestion(baseInput());
    expect(await store.removeQuestion(question.id)).toBe(true);
    expect(await store.removeQuestion(question.id)).toBe(false);
  });

  it("finds a question by id, or returns null", async () => {
    const question = await store.addQuestion(baseInput());
    expect((await store.getQuestionById(question.id))?.id).toBe(question.id);
    expect(await store.getQuestionById("q999")).toBeNull();
  });
});
