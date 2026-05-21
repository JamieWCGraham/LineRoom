import { describe, expect, it } from "vitest";

import {
  draftFingerprint,
  normalizeDraftForFingerprint,
  shouldSkipDraftCritiqueGate,
} from "@/lib/draftFingerprint";

describe("draftFingerprint", () => {
  it("treats drafts identical modulo whitespace", () => {
    const a = "hello\n\nworld";
    const b = "hello world";
    const c = "hello\tworld";
    expect(normalizeDraftForFingerprint(a)).toBe("helloworld");
    expect(draftFingerprint(a)).toBe(draftFingerprint(b));
    expect(draftFingerprint(a)).toBe(draftFingerprint(c));
  });

  it("differs when lyric content differs", () => {
    expect(draftFingerprint("hello world")).not.toBe(
      draftFingerprint("hello worlds"),
    );
  });

  it("skips gate when normalized length is below 40", () => {
    expect(shouldSkipDraftCritiqueGate("short")).toBe(true);
    expect(shouldSkipDraftCritiqueGate("a".repeat(40))).toBe(false);
  });
});
