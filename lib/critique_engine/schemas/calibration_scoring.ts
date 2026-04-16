import { z } from "zod";
import { dimensionScore1to5Schema } from "@/lib/critique_engine/schemas/dimension_score";

const rationale = z.string().min(4).max(420);

const calibrationRatingBandSchema = z
  .string()
  .transform((raw) => {
    const key = raw.toLowerCase().trim().replace(/\s+/g, " ");
    const m: Record<string, "Needs Work" | "Promising" | "Strong" | "Standout"> = {
      "needs work": "Needs Work",
      needswork: "Needs Work",
      promising: "Promising",
      strong: "Strong",
      standout: "Standout",
    };
    return m[key] ?? raw.trim();
  })
  .pipe(z.enum(["Needs Work", "Promising", "Strong", "Standout"]));

export const calibrationScoringOutputSchema = z.object({
  overallRatingBand: calibrationRatingBandSchema,
  subscores: z.object({
    emotionalImpact: dimensionScore1to5Schema,
    imagerySpecificity: dimensionScore1to5Schema,
    originalityVoice: dimensionScore1to5Schema,
    prosodySingability: dimensionScore1to5Schema,
    structureCohesion: dimensionScore1to5Schema,
    lyricalEconomy: dimensionScore1to5Schema,
    hookStrength: dimensionScore1to5Schema,
  }),
  subscoreRationales: z.object({
    emotionalImpact: rationale,
    imagerySpecificity: rationale,
    originalityVoice: rationale,
    prosodySingability: rationale,
    structureCohesion: rationale,
    lyricalEconomy: rationale,
    hookStrength: rationale,
  }),
  diagnosticSummaryShort: z.string().min(8).max(520),
  calibrationConfidence: z.number().min(0).max(1),
});

export type CalibrationScoringOutput = z.infer<typeof calibrationScoringOutputSchema>;
