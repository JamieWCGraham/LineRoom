import { describe, expect, it } from "vitest";
import {
  emptyGroundTruthStrengthsWeaknesses,
  parseGroundTruthStrengthsWeaknesses,
} from "@/lib/evals/strengthWeaknessGroundTruth";
import {
  aggregateStrengthWeaknessRunMetrics,
  parseStrengthWeaknessEvalFromOutputJson,
  strengthWeaknessJudgeComposite,
} from "@/lib/evals/strengthWeaknessMetrics";

describe("parseGroundTruthStrengthsWeaknesses", () => {
  it("accepts valid objects", () => {
    const raw = {
      overallStrengths: ["a"],
      overallWeaknesses: ["b", "c"],
    };
    expect(parseGroundTruthStrengthsWeaknesses(raw)).toEqual(raw);
  });

  it("rejects non-arrays", () => {
    expect(parseGroundTruthStrengthsWeaknesses({ overallStrengths: "x" })).toBeNull();
  });

  it("emptyGroundTruthStrengthsWeaknesses is valid parse", () => {
    expect(parseGroundTruthStrengthsWeaknesses(emptyGroundTruthStrengthsWeaknesses())).toEqual(
      emptyGroundTruthStrengthsWeaknesses(),
    );
  });
});

describe("aggregateStrengthWeaknessRunMetrics", () => {
  it("averages rubric scores and counts flags", () => {
    const a = {
      specificity: 4,
      evidence_grounding: 4,
      non_redundancy: 2,
      actionability: 3,
      fairness: 5,
      failure_flags: ["generic_praise", "generic_praise"],
    };
    const b = {
      specificity: 2,
      evidence_grounding: 2,
      non_redundancy: 2,
      actionability: 2,
      fairness: 2,
      failure_flags: ["too_harsh"],
    };
    const m = aggregateStrengthWeaknessRunMetrics([a, b, null]);
    expect(m.comparedRows).toBe(2);
    expect(m.meanSpecificity).toBe(3);
    expect(m.meanCompositeRubric).toBeCloseTo(2.8, 5);
    expect(m.failureFlagCounts.generic_praise).toBe(2);
    expect(m.failureFlagCounts.too_harsh).toBe(1);
  });

  it("returns null means when empty", () => {
    const m = aggregateStrengthWeaknessRunMetrics([]);
    expect(m.comparedRows).toBe(0);
    expect(m.meanSpecificity).toBeNull();
  });
});

describe("strengthWeaknessJudgeComposite", () => {
  it("returns mean of five rubric scores", () => {
    expect(
      strengthWeaknessJudgeComposite({
        specificity: 2,
        evidence_grounding: 4,
        non_redundancy: 4,
        actionability: 3,
        fairness: 5,
        failure_flags: [],
      }),
    ).toBeCloseTo(3.6, 5);
  });

  it("returns null without judge", () => {
    expect(strengthWeaknessJudgeComposite(null)).toBeNull();
  });
});

describe("parseStrengthWeaknessEvalFromOutputJson", () => {
  it("reads nested strengthWeaknessEval", () => {
    const parsed = {
      strengthWeaknessEval: {
        specificity: 3,
        evidence_grounding: 4,
        non_redundancy: 3,
        actionability: 5,
        fairness: 4,
        failure_flags: ["generic_criticism"],
        notes: "ok",
      },
    };
    expect(parseStrengthWeaknessEvalFromOutputJson(parsed)).toMatchObject({
      specificity: 3,
      failure_flags: ["generic_criticism"],
      notes: "ok",
    });
  });

  it("returns null when missing or incomplete", () => {
    expect(parseStrengthWeaknessEvalFromOutputJson({})).toBeNull();
    expect(
      parseStrengthWeaknessEvalFromOutputJson({
        strengthWeaknessEval: { specificity: 1 },
      }),
    ).toBeNull();
  });
});
