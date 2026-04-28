import { z } from "zod";
import type { CritiqueResult, LyricDimension, LyricSubscores } from "@/lib/types";
import type { CanonicalRatingBand } from "./ratingBands";

export const SUBSCORE_DIMENSIONS: LyricDimension[] = [
  "emotional_impact",
  "imagery_specificity",
  "originality_voice",
  "prosody_singability",
  "structure_cohesion",
  "lyrical_economy",
  "hook_strength",
];

export const lyricSubscoresJsonSchema = z.object({
  emotional_impact: z.number().int().min(1).max(5),
  imagery_specificity: z.number().int().min(1).max(5),
  originality_voice: z.number().int().min(1).max(5),
  prosody_singability: z.number().int().min(1).max(5),
  structure_cohesion: z.number().int().min(1).max(5),
  lyrical_economy: z.number().int().min(1).max(5),
  hook_strength: z.number().int().min(1).max(5),
});

export type LyricSubscoresJson = z.infer<typeof lyricSubscoresJsonSchema>;

export type SubscoreCalibrationResult = {
  meanAbsoluteError: number;
  perDimensionDistance: Record<LyricDimension, number>;
  withinToleranceCount: number;
  failureCount: number;
  bandConsistency: "pass" | "warn" | "fail";
};

function getExpectedBandRange(
  band: CanonicalRatingBand,
): { min: number; max: number } {
  if (band === "Needs Work") return { min: 1, max: 2 };
  if (band === "Promising") return { min: 2, max: 3 };
  if (band === "Strong") return { min: 3, max: 4 };
  return { min: 4, max: 5 };
}

export function parseGroundTruthSubscores(raw: unknown): LyricSubscoresJson | null {
  const parsed = lyricSubscoresJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function evaluateSubscoreCalibration(input: {
  predicted: LyricSubscores;
  groundTruth: LyricSubscoresJson;
  overallBand: CanonicalRatingBand | null;
}): SubscoreCalibrationResult {
  let totalDistance = 0;
  let withinToleranceCount = 0;
  let failureCount = 0;
  const perDimensionDistance = {} as Record<LyricDimension, number>;

  for (const dim of SUBSCORE_DIMENSIONS) {
    const distance = Math.abs(input.predicted[dim] - input.groundTruth[dim]);
    perDimensionDistance[dim] = distance;
    totalDistance += distance;
    if (distance <= 1) withinToleranceCount += 1;
    if (distance >= 2) failureCount += 1;
  }

  let bandConsistency: "pass" | "warn" | "fail" = "warn";
  if (input.overallBand) {
    const range = getExpectedBandRange(input.overallBand);
    const offBand = SUBSCORE_DIMENSIONS.filter((dim) => {
      const v = input.predicted[dim];
      return v < range.min || v > range.max;
    }).length;
    bandConsistency =
      offBand === 0 ? "pass"
      : offBand <= 2 ? "warn"
      : "fail";
  }

  return {
    meanAbsoluteError: totalDistance / SUBSCORE_DIMENSIONS.length,
    perDimensionDistance,
    withinToleranceCount,
    failureCount,
    bandConsistency,
  };
}

export function getCritiqueExplanationText(critique: CritiqueResult): string {
  const strengths = critique.overallStrengths.map((x) => `- ${x}`).join("\n");
  const weaknesses = critique.overallWeaknesses.map((x) => `- ${x}`).join("\n");
  return [
    critique.overallBandRationale?.trim() || "",
    "Overall strengths:",
    strengths || "- (none)",
    "Overall weaknesses:",
    weaknesses || "- (none)",
  ]
    .filter(Boolean)
    .join("\n");
}
