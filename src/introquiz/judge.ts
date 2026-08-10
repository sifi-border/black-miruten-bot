const FULLWIDTH_ALNUM_PATTERN = /[Ａ-Ｚａ-ｚ０-９]/g;
const KATAKANA_PATTERN = /[ァ-ヶ]/g;
const WHITESPACE_PATTERN = /\s+/g;

export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .replace(FULLWIDTH_ALNUM_PATTERN, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(KATAKANA_PATTERN, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(WHITESPACE_PATTERN, "");
}

export function isCorrectAnswer(candidate: string, answers: string[]): boolean {
  const normalizedCandidate = normalizeAnswer(candidate);
  if (!normalizedCandidate) return false;
  return answers.some((answer) => normalizeAnswer(answer) === normalizedCandidate);
}
