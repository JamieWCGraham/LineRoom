import { describe, expect, it } from "vitest";

import {
  applyCanonicalScores,
  scoresMatchCanonical,
} from "@/lib/critique/enforceCanonicalScores";
import type { CritiqueResult } from "@/lib/types";

const canonical = {
  overallRatingBand: "Strong" as const,
  subscores: {
    emotional_impact: 4 as const,
    imagery_specificity: 3 as const,
    originality_voice: 4 as const,
    prosody_singability: 4 as const,
    structure_cohesion: 3 as const,
    lyrical_economy: 4 as const,
    hook_strength: 3 as const,
  },
};

function minimalCritique(
  overrides: Partial<Pick<CritiqueResult, "overallRatingBand" | "subscores">> = {},
): CritiqueResult {
  return {
    genrePrinciples: "x",
    overallRatingBand: overrides.overallRatingBand ?? "Strong",
    subscores: overrides.subscores ?? canonical.subscores,
    overallStrengths: [],
    overallWeaknesses: [],
    lineFeedback: [],
  };
}

describe("enforceCanonicalScores", () => {
  it("detects score mismatch", () => {
    const c = minimalCritique({
      subscores: { ...canonical.subscores, hook_strength: 5 },
    });
    expect(scoresMatchCanonical(c, canonical)).toBe(false);
  });

  it("overwrites band and subscores", () => {
    const c = minimalCritique({
      overallRatingBand: "Promising",
      subscores: { ...canonical.subscores, hook_strength: 2 },
    });
    const out = applyCanonicalScores(c, canonical);
    expect(out.overallRatingBand).toBe("Strong");
    expect(out.subscores.hook_strength).toBe(3);
    expect(out.lineFeedback).toEqual([]);
  });
});
