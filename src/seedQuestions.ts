import "dotenv/config";
import { promises as fs } from "node:fs";
import { computeNextId } from "./introquiz/questionStore";
import { createMongoQuestionRepository, type QuizQuestion } from "./introquiz/questionRepository";
import { messages } from "./messages";

type SeedInput = Omit<QuizQuestion, "id"> & { id?: string };

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(messages.seedQuestions.usage);
    process.exit(1);
  }

  const raw = await fs.readFile(filePath, "utf-8");
  const inputs = JSON.parse(raw) as SeedInput[];

  const repository = createMongoQuestionRepository();
  try {
    const existingIds = await repository.findAllIds();

    let insertedCount = 0;
    for (const input of inputs) {
      const id = input.id ?? computeNextId(existingIds);
      existingIds.push(id);
      await repository.insert({ ...input, id });
      insertedCount += 1;
    }

    console.log(messages.seedQuestions.inserted(insertedCount));
  } finally {
    await repository.close();
  }
}

main().catch((error) => {
  console.error(messages.seedQuestions.failed, error);
  process.exit(1);
});
