import { describe, expect, it } from "vitest";
import {
  emptyGroundTruthLineFeedback,
  hasLineFeedbackGoldForJudge,
  parseGroundTruthLineFeedback,
} from "@/lib/evals/lineFeedbackGroundTruth";
import {
  aggregateLineFeedbackRunMetrics,
  lineFeedbackJudgeToSnapshot,
  lineFeedbackWeightedComposite,
  parseLineFeedbackEvalFromOutputJson,
} from "@/lib/evals/lineFeedbackMetrics";

describe("parseGroundTruthLineFeedback", () => {
  it("accepts valid objects", () => {
    const raw = {
      mustCommentLines: ["a", "b"],
      optionalCommentLines: [],
      anchorLines: [{ quotedLine: "a", expectedStrength: "strong" as const }],
    };
    expect(parseGroundTruthLineFeedback(raw)).toEqual(raw);
  });

  it("rejects bad shapes", () => {
    expect(parseGroundTruthLineFeedback({ mustCommentLines: "x" })).toBeNull();
  });

  it("hasLineFeedbackGoldForJudge", () => {
    expect(hasLineFeedbackGoldForJudge(null)).toBe(false);
    expect(hasLineFeedbackGoldForJudge(emptyGroundTruthLineFeedback())).toBe(false);
    expect(
      hasLineFeedbackGoldForJudge({
        mustCommentLines: ["hook line here"],
        optionalCommentLines: [],
        anchorLines: [],
      }),
    ).toBe(true);
    expect(
      hasLineFeedbackGoldForJudge({
        mustCommentLines: [],
        optionalCommentLines: [],
        anchorLines: [{ quotedLine: "only anchor" }],
      }),
    ).toBe(true);
  });
});

describe("lineFeedbackWeightedComposite", () => {
  it("matches architecture weights on mid scores", () => {
    const c = lineFeedbackWeightedComposite({
      coverage: 0.8,
      label_calibration: 0.5,
      specificity: 3,
      revision_usefulness: 3,
      context_awareness: 3,
    });
    const norm = (3 - 1) / 4;
    expect(c).toBeCloseTo(
      0.25 * 0.8 + 0.2 * 0.5 + 0.2 * norm + 0.2 * norm + 0.15 * norm,
      5,
    );
  });
});

describe("lineFeedbackJudgeToSnapshot", () => {
  it("embeds weighted composite", () => {
    const snap = lineFeedbackJudgeToSnapshot({
      coverage: 1,
      label_calibration: 1,
      specificity: 5,
      revision_usefulness: 5,
      context_awareness: 5,
      failure_flags: [],
      notes: "ok",
    });
    expect(snap.line_level_composite).toBeCloseTo(1, 5);
  });
});

describe("aggregateLineFeedbackRunMetrics", () => {
  it("averages and counts flags", () => {
    const a = lineFeedbackJudgeToSnapshot({
      coverage: 0.5,
      label_calibration: 0.5,
      specificity: 4,
      revision_usefulness: 3,
      context_awareness: 2,
      failure_flags: ["generic_line_notes"],
      notes: "",
    });
    const b = lineFeedbackJudgeToSnapshot({
      coverage: 1,
      label_calibration: 0,
      specificity: 2,
      revision_usefulness: 2,
      context_awareness: 2,
      failure_flags: ["missed_must_line", "generic_line_notes"],
      notes: "",
    });
    const m = aggregateLineFeedbackRunMetrics([a, b, null]);
    expect(m.comparedRows).toBe(2);
    expect(m.failureFlagCounts.generic_line_notes).toBe(2);
    expect(m.failureFlagCounts.missed_must_line).toBe(1);
    expect(m.meanCoverage).toBeCloseTo(0.75, 5);
  });
});

describe("parseLineFeedbackEvalFromOutputJson", () => {
  it("reads nested lineFeedbackEval", () => {
    const parsed = {
      lineFeedbackEval: {
        coverage: 0.7,
        label_calibration: 0.6,
        specificity: 4,
        revision_usefulness: 3,
        context_awareness: 4,
        line_level_composite: 0.55,
        failure_flags: ["weak_context"],
        notes: "ok",
      },
    };
    expect(parseLineFeedbackEvalFromOutputJson(parsed)).toMatchObject({
      coverage: 0.7,
      line_level_composite: 0.55,
      failure_flags: ["weak_context"],
    });
  });

  it("returns null when incomplete", () => {
    expect(parseLineFeedbackEvalFromOutputJson({})).toBeNull();
    expect(
      parseLineFeedbackEvalFromOutputJson({
        lineFeedbackEval: { coverage: 0.5 },
      }),
    ).toBeNull();
  });
});
