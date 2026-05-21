import type { DraftCritiqueGateHit } from "@/lib/critique/draftCritiqueGate";
import type { CritiqueResult } from "@/lib/types";

const SUBSCORE_KEYS = [
  "emotional_impact",
  "imagery_specificity",
  "originality_voice",
  "prosody_singability",
  "structure_cohesion",
  "lyrical_economy",
  "hook_strength",
] as const;

export function scoresMatchCanonical(
  critique: Pick<CritiqueResult, "overallRatingBand" | "subscores">,
  canonical: DraftCritiqueGateHit,
): boolean {
  if (critique.overallRatingBand !== canonical.overallRatingBand) return false;
  for (const key of SUBSCORE_KEYS) {
    if (critique.subscores[key] !== canonical.subscores[key]) return false;
  }
  return true;
}

export function applyCanonicalScores(
  critique: CritiqueResult,
  canonical: DraftCritiqueGateHit,
): CritiqueResult {
  return {
    ...critique,
    overallRatingBand: canonical.overallRatingBand,
    subscores: { ...canonical.subscores },
  };
}
