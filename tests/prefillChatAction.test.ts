import { describe, expect, it } from "vitest";
import { prefillChatAction } from "@/lib/chat/prefillChatAction";

describe("prefillChatAction", () => {
  it("prefills thesaurus wording for selection scope", () => {
    const text = prefillChatAction(
      "diagnose",
      "selection",
      "verse",
      { pins: [{ startLine: 0, endLine: 0, text: "hello world" }], multipleSelections: false },
    );
    expect(text.toLowerCase()).toContain("similar");
  });

  it("prefills rhyme prompt with anchor word from pins", () => {
    const text = prefillChatAction(
      "find_rhymes",
      "selection",
      "verse",
      { pins: [{ startLine: 0, endLine: 0, text: "on the flat" }] },
    );
    expect(text).toContain("flat");
    expect(text.toLowerCase()).toContain("rhyme");
  });
});
