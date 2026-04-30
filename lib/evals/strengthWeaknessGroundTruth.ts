import { z } from "zod";

/** Mirrors `CritiqueResult` overall bullets; stored as JSON on the eval set row. */
export const groundTruthStrengthsWeaknessesSchema = z.object({
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
});

export type GroundTruthStrengthsWeaknesses = z.infer<
  typeof groundTruthStrengthsWeaknessesSchema
>;

export function parseGroundTruthStrengthsWeaknesses(
  raw: unknown,
): GroundTruthStrengthsWeaknesses | null {
  const parsed = groundTruthStrengthsWeaknessesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function emptyGroundTruthStrengthsWeaknesses(): GroundTruthStrengthsWeaknesses {
  return { overallStrengths: [], overallWeaknesses: [] };
}
