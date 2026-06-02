import { describe, expect, it } from "vitest";
import {
  parseDraftForDisplay,
  sectionDisplayLabel,
} from "@/lib/lyrics/parseDraftForDisplay";

describe("sectionDisplayLabel", () => {
  it("reads bracketed headers", () => {
    expect(sectionDisplayLabel("[Verse 1]")).toBe("Verse 1");
    expect(sectionDisplayLabel("  [Chorus]  ")).toBe("Chorus");
  });

  it("reads short standalone labels", () => {
    expect(sectionDisplayLabel("Bridge")).toBe("Bridge");
    expect(sectionDisplayLabel("CHORUS:")).toBe("CHORUS");
  });

  it("rejects labels with lyric text on the same line", () => {
    expect(sectionDisplayLabel("CHORUS: Cause I can't make you love me")).toBe(
      null,
    );
  });
});

describe("parseDraftForDisplay", () => {
  it("splits sections and stanzas", () => {
    const draft = `[Verse 1]
First line
Second line

Third stanza line

[Chorus]
Hook line`;

    const { sections } = parseDraftForDisplay(draft);
    expect(sections).toHaveLength(2);
    expect(sections[0].label).toBe("Verse 1");
    expect(sections[0].stanzas).toEqual([
      ["First line", "Second line"],
      ["Third stanza line"],
    ]);
    expect(sections[1].label).toBe("Chorus");
    expect(sections[1].stanzas).toEqual([["Hook line"]]);
  });

  it("groups unlabeled lyrics into one section", () => {
    const draft = `Line one
Line two

Line three`;

    const { sections } = parseDraftForDisplay(draft);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBeNull();
    expect(sections[0].stanzas).toEqual([
      ["Line one", "Line two"],
      ["Line three"],
    ]);
  });
});
