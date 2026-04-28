import { describe, expect, it } from "vitest";
import {
  evaluateSubscoreCalibration,
  parseGroundTruthSubscores,
} from "@/lib/evals/subscoreCalibration";

describe("subscore calibration", () => {
  it("parses valid ground-truth subscores", () => {
    const parsed = parseGroundTruthSubscores({
      emotional_impact: 4,
      imagery_specificity: 4,
      originality_voice: 3,
      prosody_singability: 4,
      structure_cohesion: 4,
      lyrical_economy: 3,
      hook_strength: 4,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.emotional_impact).toBe(4);
  });

  it("computes MAE and tolerance stats", () => {
    const out = evaluateSubscoreCalibration({
      overallBand: "Strong",
      predicted: {
        emotional_impact: 4,
        imagery_specificity: 2,
        originality_voice: 3,
        prosody_singability: 4,
        structure_cohesion: 4,
        lyrical_economy: 2,
        hook_strength: 5,
      },
      groundTruth: {
        emotional_impact: 4,
        imagery_specificity: 3,
        originality_voice: 3,
        prosody_singability: 4,
        structure_cohesion: 4,
        lyrical_economy: 4,
        hook_strength: 4,
      },
    });
    expect(out.meanAbsoluteError).toBeCloseTo(4 / 7, 5);
    expect(out.withinToleranceCount).toBe(6);
    expect(out.failureCount).toBe(1);
  });
});
