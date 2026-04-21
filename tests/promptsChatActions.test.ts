import { describe, expect, it } from "vitest";
import { buildChatActionSystemPrompt } from "@/lib/prompts";
import type { ChatActionPayload } from "@/types/chat";

function payload(
  action: ChatActionPayload["action"],
): ChatActionPayload {
  return {
    action,
    scope: "section",
    userMessage: "test",
    draft: "line one\nline two",
    section: { type: "verse", text: "line one" },
  };
}

describe("buildChatActionSystemPrompt", () => {
  it("uses thesaurus-style rules for diagnose action", () => {
    const system = buildChatActionSystemPrompt(payload("diagnose"));
    expect(system).toContain("THESAURUS");
    expect(system).toContain("synonym");
    expect(system).not.toContain("DIAGNOSE (is it landing?");
  });

  it("labels rhyme action as RHYME", () => {
    const system = buildChatActionSystemPrompt(payload("find_rhymes"));
    expect(system).toContain("Action: RHYME");
  });

  it("keeps suggestions action as rewrites", () => {
    const system = buildChatActionSystemPrompt(payload("suggest_rewrites"));
    expect(system).toContain("SUGGEST REWRITES");
  });
});
