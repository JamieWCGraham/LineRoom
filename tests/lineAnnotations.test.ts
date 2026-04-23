import { describe, it, expect } from "vitest";
import {
  buildLineFeedbackByIndex,
  normalizeLineForMatch,
  resolveLineIndicesForQuote,
} from "@/lib/lineAnnotations";

describe("normalizeLineForMatch", () => {
  it("collapses whitespace and maps smart quotes", () => {
    expect(normalizeLineForMatch("  a  \tb  ")).toBe("a b");
    expect(normalizeLineForMatch("\u2018cold\u2019")).toBe("'cold'");
  });
});

describe("resolveLineIndicesForQuote", () => {
  const draft = "First line here\nSecond line\nThird";

  it("matches exact line including spaces", () => {
    const lines = draft.split("\n");
    expect(resolveLineIndicesForQuote(lines, "Second line")).toEqual([1]);
  });

  it("matches all lines with same trimmed text", () => {
    const lines = "hello\nhello\nx".split("\n");
    expect(resolveLineIndicesForQuote(lines, "hello")).toEqual([0, 1]);
  });

  it("does not pin a one-letter quote to the first line containing that letter", () => {
    const lines = "I am the walrus\nYou are not\nI agree".split("\n");
    expect(resolveLineIndicesForQuote(lines, "I")).toEqual([]);
  });

  it("matches via normalization when quotes differ", () => {
    const lines = "She said 'run'".split("\n");
    expect(resolveLineIndicesForQuote(lines, "She said \u2018run\u2019")).toEqual([0]);
  });
});

describe("buildLineFeedbackByIndex", () => {
  it("maps feedback to the correct line, not first substring hit", () => {
    const draft = "alpha beta\nshort\nalpha beta gamma";
    const map = buildLineFeedbackByIndex(draft, [
      {
        quotedLine: "short",
        feedback: "note for short",
        category: "constructive",
        strength: "suggestion",
      },
    ]);
    expect(map.size).toBe(1);
    expect(map.get(1)?.[0]?.feedback).toBe("note for short");
    expect(map.has(0)).toBe(false);
    expect(map.has(2)).toBe(false);
  });

  it("applies the same item to every identical line when trim-equal", () => {
    const draft = "repeat\nrepeat\nother";
    const map = buildLineFeedbackByIndex(draft, [
      {
        quotedLine: "repeat",
        feedback: "dup",
        category: "praise",
        strength: "strong",
      },
    ]);
    expect(map.get(0)?.length).toBe(1);
    expect(map.get(1)?.length).toBe(1);
    expect(map.get(0)?.[0]?.feedback).toBe("dup");
  });
});
