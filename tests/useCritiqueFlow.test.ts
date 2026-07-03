import { describe, expect, it } from "vitest";
import { shouldBumpVersionAfterCritique } from "@/lib/hooks/useCritiqueFlow";
import type { CritiqueResult } from "@/lib/types";

const sampleCritique = {
  genrePrinciples: "",
  overallRatingBand: "Promising" as const,
  subscores: {
    emotional_impact: 3 as const,
    imagery_specificity: 3 as const,
    originality_voice: 3 as const,
    prosody_singability: 3 as const,
    structure_cohesion: 3 as const,
    lyrical_economy: 3 as const,
    hook_strength: 3 as const,
  },
  overallStrengths: [],
  overallWeaknesses: [],
  lineFeedback: [],
} satisfies CritiqueResult;

describe("shouldBumpVersionAfterCritique", () => {
  it("does not bump on first critique (e.g. v1 before any saved critique)", () => {
    expect(shouldBumpVersionAfterCritique(false, null)).toBe(false);
  });

  it("bumps when regenerating an existing critique", () => {
    expect(shouldBumpVersionAfterCritique(true, sampleCritique)).toBe(true);
  });

  it("does not bump when regenerate flag is set without an existing critique", () => {
    expect(shouldBumpVersionAfterCritique(true, null)).toBe(false);
  });
});
