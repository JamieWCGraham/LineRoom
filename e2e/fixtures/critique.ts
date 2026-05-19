import type { CritiqueResult } from "@/lib/types";

/** Minimal valid critique for route stubs and UI smoke tests. */
export const minimalCritiqueFixture: CritiqueResult = {
  genrePrinciples: "Test genre principles for E2E.",
  overallRatingBand: "Promising",
  overallBandRationale: "Fixture rationale.",
  subscores: {
    emotional_impact: 3,
    imagery_specificity: 3,
    originality_voice: 3,
    prosody_singability: 3,
    structure_cohesion: 3,
    lyrical_economy: 3,
    hook_strength: 3,
  },
  overallStrengths: ["Strong opening line"],
  overallWeaknesses: ["Verse two could be tighter"],
  lineFeedback: [
    {
      quotedLine: "test line one",
      feedback: "Nice imagery.",
      category: "praise",
      strength: "strong",
    },
  ],
};
