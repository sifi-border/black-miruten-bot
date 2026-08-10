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

export interface QuestionRepository {
  findByGuildId(guildId: string): Promise<QuizQuestion[]>;
  findAllIds(): Promise<string[]>;
  insert(question: QuizQuestion): Promise<void>;
  findById(id: string): Promise<QuizQuestion | null>;
  updateById(id: string, patch: Partial<Omit<QuizQuestion, "id">>): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  close(): Promise<void>;
}

const COLLECTION_NAME = "quizQuestions";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(messages.env.missingMongodbUri);
  return uri;
}

export function createMongoQuestionRepository(): QuestionRepository {
  let clientPromise: Promise<MongoClient> | null = null;

  async function getCollection(): Promise<Collection<QuizQuestion>> {
    if (!clientPromise) {
      clientPromise = new MongoClient(getMongoUri()).connect();
    }
    const client = await clientPromise;
    return client.db().collection<QuizQuestion>(COLLECTION_NAME);
  }

  return {
    async findByGuildId(guildId) {
      const collection = await getCollection();
      return collection.find({ guildId }, { projection: { _id: 0 } }).toArray();
    },

    async findAllIds() {
      const collection = await getCollection();
      const docs = await collection.find({}, { projection: { id: 1, _id: 0 } }).toArray();
      return docs.map((doc) => doc.id);
    },

    async insert(question) {
      const collection = await getCollection();
      // insertOneは渡したオブジェクトに_idを書き込んでミューテートするため、コピーを渡す
      await collection.insertOne({ ...question });
    },

    async findById(id) {
      const collection = await getCollection();
      return collection.findOne({ id }, { projection: { _id: 0 } });
    },

    async updateById(id, patch) {
      const collection = await getCollection();
      const result = await collection.updateOne({ id }, { $set: patch });
      return result.matchedCount > 0;
    },

    async deleteById(id) {
      const collection = await getCollection();
      const result = await collection.deleteOne({ id });
      return result.deletedCount === 1;
    },

    async close() {
      if (!clientPromise) return;
      const client = await clientPromise;
      await client.close();
    },
  };
}
