import { describe, expect, it } from "vitest";
import { bandSortRank } from "@/lib/evals/ui/groundTruthTable";
import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";
import {
  compareGroundTruthRows,
  filterGroundTruthRows,
} from "@/lib/evals/ui/groundTruthTable";
import { GT_FILTERS_EMPTY } from "@/lib/evals/ui/types";
import type { GroundTruthRow } from "@/lib/evals/ui/types";

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

function row(partial: Partial<GroundTruthRow> & Pick<GroundTruthRow, "id">): GroundTruthRow {
  return {
    title: "",
    artist: "",
    overallScore: "Promising",
    isCorrect: true,
    predictedOverallScore: "Promising",
    strengthWeaknessDrilldown: {
      status: "ok",
      goldStrengths: [],
      goldWeaknesses: [],
      predictedStrengths: [],
      predictedWeaknesses: [],
      judge: null,
    },
    lineFeedbackDrilldown: {
      status: "ok",
      goldMustLines: [],
      goldOptionalLines: [],
      predictedLineFeedback: [],
      judge: null,
    },
    ...partial,
  };
}

describe("filterGroundTruthRows", () => {
  it("filters by isCorrect", () => {
    const rows = [
      row({ id: 1, isCorrect: true }),
      row({ id: 2, isCorrect: false }),
    ];
    const filtered = filterGroundTruthRows(rows, {
      ...GT_FILTERS_EMPTY,
      isCorrect: "false",
    });
    expect(filtered.map((r) => r.id)).toEqual([2]);
  });
});

describe("compareGroundTruthRows", () => {
  it("sorts by id ascending", () => {
    const a = row({ id: 2 });
    const b = row({ id: 1 });
    expect(compareGroundTruthRows(a, b, "id", "asc")).toBeGreaterThan(0);
  });
});
