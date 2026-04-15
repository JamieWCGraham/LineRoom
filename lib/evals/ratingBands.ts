import { overallRatingBandSchema } from "@/lib/validators";

export const CANONICAL_RATING_BANDS = [
  "Needs Work",
  "Promising",
  "Strong",
  "Standout",
] as const;

export type CanonicalRatingBand =
  (typeof CANONICAL_RATING_BANDS)[number];

export function parseOverallScoreFromDb(raw: unknown): CanonicalRatingBand | null {
  if (typeof raw === "string") {
    const p = overallRatingBandSchema.safeParse(raw.trim());
    return p.success ? p.data : null;
  }
  return null;
}

export function parseOverallRatingBandFromOutputJson(
  raw: unknown,
): CanonicalRatingBand | null {
  if (!raw || typeof raw !== "object") return null;
  const critique = (raw as { critique?: unknown }).critique;
  if (!critique || typeof critique !== "object") return null;
  const band = (critique as { overallRatingBand?: unknown }).overallRatingBand;
  const p = overallRatingBandSchema.safeParse(band);
  return p.success ? p.data : null;
}
