import { promises as fs } from "node:fs";
import path from "node:path";

export interface QuizQuestion {
  id: string;
  youtubeUrl: string;
  startSeconds: number;
  durationSeconds: number;
  title: string;
  artist: string;
  answers: string[];
}

const DEFAULT_DATA_PATH = path.resolve(process.cwd(), "data", "quiz-questions.json");

function resolveDataPath(): string {
  return process.env.QUIZ_DATA_PATH ? path.resolve(process.env.QUIZ_DATA_PATH) : DEFAULT_DATA_PATH;
}

async function ensureDataFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

async function readAll(): Promise<QuizQuestion[]> {
  const filePath = resolveDataPath();
  await ensureDataFile(filePath);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuizQuestion[];
}

async function writeAll(questions: QuizQuestion[]): Promise<void> {
  await fs.writeFile(resolveDataPath(), JSON.stringify(questions, null, 2), "utf-8");
}

function nextId(questions: QuizQuestion[]): string {
  const maxNumber = questions.reduce((max, question) => {
    const match = /^q(\d+)$/.exec(question.id);
    if (!match) return max;
    const n = Number.parseInt(match[1], 10);
    return n > max ? n : max;
  }, 0);
  return `q${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function loadAllQuestions(): Promise<QuizQuestion[]> {
  return readAll();
}

export async function addQuestion(input: Omit<QuizQuestion, "id">): Promise<QuizQuestion> {
  const questions = await readAll();
  const question: QuizQuestion = { id: nextId(questions), ...input };
  questions.push(question);
  await writeAll(questions);
  return question;
}

export async function updateQuestion(
  id: string,
  patch: Partial<Omit<QuizQuestion, "id">>,
): Promise<QuizQuestion | null> {
  const questions = await readAll();
  const index = questions.findIndex((question) => question.id === id);
  if (index === -1) return null;

  const updated = { ...questions[index], ...patch };
  questions[index] = updated;
  await writeAll(questions);
  return updated;
}

export async function removeQuestion(id: string): Promise<boolean> {
  const questions = await readAll();
  const next = questions.filter((question) => question.id !== id);
  if (next.length === questions.length) return false;

  await writeAll(next);
  return true;
}

export async function getQuestionById(id: string): Promise<QuizQuestion | null> {
  const questions = await readAll();
  return questions.find((question) => question.id === id) ?? null;
}
