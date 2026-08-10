import { MongoClient, type Collection } from "mongodb";
import { messages } from "../messages";

export interface QuizQuestion {
  id: string;
  guildId: string;
  youtubeUrl: string;
  startSeconds: number;
  durationSeconds: number;
  title: string;
  artist: string;
  answers: string[];
}

const COLLECTION_NAME = "quizQuestions";

let clientPromise: Promise<MongoClient> | null = null;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(messages.env.missingMongodbUri);
  return uri;
}

async function getCollection(): Promise<Collection<QuizQuestion>> {
  if (!clientPromise) {
    clientPromise = new MongoClient(getMongoUri()).connect();
  }
  const client = await clientPromise;
  return client.db().collection<QuizQuestion>(COLLECTION_NAME);
}

export function computeNextId(existingIds: string[]): string {
  const maxNumber = existingIds.reduce((max, id) => {
    const match = /^q(\d+)$/.exec(id);
    if (!match) return max;
    const n = Number.parseInt(match[1], 10);
    return n > max ? n : max;
  }, 0);
  return `q${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function loadQuestionsByGuild(guildId: string): Promise<QuizQuestion[]> {
  const collection = await getCollection();
  return collection.find({ guildId }, { projection: { _id: 0 } }).toArray();
}

export async function addQuestion(input: Omit<QuizQuestion, "id">): Promise<QuizQuestion> {
  const collection = await getCollection();
  const existingIds = (await collection.find({}, { projection: { id: 1, _id: 0 } }).toArray()).map(
    (question) => question.id,
  );

  const id = computeNextId(existingIds);
  // insertOneは渡したオブジェクトに_idを書き込んで返すため、戻り値用に別オブジェクトを用意する
  await collection.insertOne({ id, ...input });
  return { id, ...input };
}

export async function updateQuestion(
  id: string,
  patch: Partial<Omit<QuizQuestion, "id">>,
): Promise<QuizQuestion | null> {
  const collection = await getCollection();
  const result = await collection.updateOne({ id }, { $set: patch });
  if (result.matchedCount === 0) return null;

  return collection.findOne({ id }, { projection: { _id: 0 } });
}

export async function removeQuestion(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}

export async function getQuestionById(id: string): Promise<QuizQuestion | null> {
  const collection = await getCollection();
  return collection.findOne({ id }, { projection: { _id: 0 } });
}
