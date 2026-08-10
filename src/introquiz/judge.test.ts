import { describe, expect, it } from "vitest";
import { isCorrectAnswer, normalizeAnswer } from "./judge";

describe("normalizeAnswer", () => {
  it("converts fullwidth alphanumerics to halfwidth", () => {
    expect(normalizeAnswer("ＡＢＣ１２３")).toBe("abc123");
  });

  it("lowercases alphabetic characters", () => {
    expect(normalizeAnswer("Hello")).toBe("hello");
  });

  it("converts katakana to hiragana", () => {
    expect(normalizeAnswer("テスト")).toBe("てすと");
  });

  it("removes all whitespace, including internal spaces", () => {
    expect(normalizeAnswer("半角 空白　全角")).toBe("半角空白全角");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeAnswer("  answer  ")).toBe("answer");
  });

  it("does not strip punctuation", () => {
    expect(normalizeAnswer("Hello, World!")).toBe("hello,world!");
  });
});

describe("isCorrectAnswer", () => {
  it("matches when normalized candidate equals a normalized answer", () => {
    expect(isCorrectAnswer("ＴＥＳＴ", ["test"])).toBe(true);
    expect(isCorrectAnswer("テスト", ["てすと", "別解"])).toBe(true);
  });

  it("does not match an unrelated candidate", () => {
    expect(isCorrectAnswer("wrong", ["test"])).toBe(false);
  });

  it("does not match an empty candidate even against an empty answer", () => {
    expect(isCorrectAnswer("   ", [""])).toBe(false);
  });
});
