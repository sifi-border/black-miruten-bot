import { describe, expect, it } from "vitest";
import { computeNextId } from "./questionStore";

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
