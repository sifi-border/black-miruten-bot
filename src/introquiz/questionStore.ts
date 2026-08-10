import {
  createMongoQuestionRepository,
  type QuestionRepository,
  type QuizQuestion,
} from "./questionRepository";

export type { QuizQuestion } from "./questionRepository";

export function computeNextId(existingIds: string[]): string {
  const maxNumber = existingIds.reduce((max, id) => {
    const match = /^q(\d+)$/.exec(id);
    if (!match) return max;
    const n = Number.parseInt(match[1], 10);
    return n > max ? n : max;
  }, 0);
  return `q${String(maxNumber + 1).padStart(3, "0")}`;
}

export function createQuestionStore(repository: QuestionRepository) {
  return {
    loadQuestionsByGuild(guildId: string): Promise<QuizQuestion[]> {
      return repository.findByGuildId(guildId);
    },

    async addQuestion(input: Omit<QuizQuestion, "id">): Promise<QuizQuestion> {
      const existingIds = await repository.findAllIds();
      const question: QuizQuestion = { id: computeNextId(existingIds), ...input };
      await repository.insert(question);
      return question;
    },

    async updateQuestion(
      id: string,
      patch: Partial<Omit<QuizQuestion, "id">>,
    ): Promise<QuizQuestion | null> {
      const matched = await repository.updateById(id, patch);
      if (!matched) return null;
      return repository.findById(id);
    },

    removeQuestion(id: string): Promise<boolean> {
      return repository.deleteById(id);
    },

    getQuestionById(id: string): Promise<QuizQuestion | null> {
      return repository.findById(id);
    },
  };
}

export const {
  loadQuestionsByGuild,
  addQuestion,
  updateQuestion,
  removeQuestion,
  getQuestionById,
} = createQuestionStore(createMongoQuestionRepository());
