import { describe, expect, it } from "vitest";
import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";

/**
 * Mirrors `bandSortRank` in evals-page-client (Needs Work → Standout).
 */
const BAND_ORDER = new Map(
  CANONICAL_RATING_BANDS.map((band, index) => [band, index] as const),
);

function bandSortRank(score: string | null | undefined): number {
  if (score == null || !String(score).trim()) {
    return CANONICAL_RATING_BANDS.length + 1;
  }
  const t = String(score).trim();
  const i = BAND_ORDER.get(t as (typeof CANONICAL_RATING_BANDS)[number]);
  if (i !== undefined) return i;
  return CANONICAL_RATING_BANDS.length;
}

describe("eval ground truth band sort rank", () => {
  it("orders canonical bands ascending by severity", () => {
    const bands = [...CANONICAL_RATING_BANDS];
    bands.sort((a, b) => bandSortRank(a) - bandSortRank(b));
    expect(bands).toEqual([
      "Needs Work",
      "Promising",
      "Strong",
      "Standout",
    ]);
  });

  it("places unknown labels after canonical bands", () => {
    expect(bandSortRank("Weird")).toBeGreaterThan(bandSortRank("Standout"));
  });

  it("places empty after Standout", () => {
    expect(bandSortRank("")).toBeGreaterThan(bandSortRank("Standout"));
    expect(bandSortRank(null)).toBeGreaterThan(bandSortRank("Standout"));
  });
});
