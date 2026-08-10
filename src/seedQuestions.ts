import "dotenv/config";
import { promises as fs } from "node:fs";
import { MongoClient } from "mongodb";
import { computeNextId, type QuizQuestion } from "./introquiz/questionStore";
import { messages } from "./messages";

const COLLECTION_NAME = "quizQuestions";

type SeedInput = Omit<QuizQuestion, "id"> & { id?: string };

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(messages.seedQuestions.usage);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(messages.env.missingMongodbUri);

  const raw = await fs.readFile(filePath, "utf-8");
  const inputs = JSON.parse(raw) as SeedInput[];

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collection = client.db().collection<QuizQuestion>(COLLECTION_NAME);

    const existingIds = (
      await collection.find({}, { projection: { id: 1, _id: 0 } }).toArray()
    ).map((question) => question.id);

    const toInsert: QuizQuestion[] = [];
    for (const input of inputs) {
      const id = input.id ?? computeNextId(existingIds);
      existingIds.push(id);
      toInsert.push({ ...input, id });
    }

    const result = await collection.insertMany(toInsert);
    console.log(messages.seedQuestions.inserted(result.insertedCount));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(messages.seedQuestions.failed, error);
  process.exit(1);
});
