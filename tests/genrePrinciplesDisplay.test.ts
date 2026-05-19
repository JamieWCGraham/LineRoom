import { describe, expect, it } from "vitest";
import { genrePrinciplesReflectionsForDisplay } from "@/lib/critique/genrePrinciplesDisplay";

describe("genrePrinciplesReflectionsForDisplay", () => {
  it("omits the first paragraph and keeps the second and third", () => {
    const raw = [
      "Genre intro paragraph.",
      "Draft aim paragraph.",
      "Tradeoff paragraph.",
      "Optional fourth.",
    ].join("\n\n");
    expect(genrePrinciplesReflectionsForDisplay(raw)).toBe(
      "Draft aim paragraph.\n\nTradeoff paragraph.",
    );
  });

  it("returns empty when only the intro paragraph is present", () => {
    expect(genrePrinciplesReflectionsForDisplay("Only intro.")).toBe("");
  });
});
