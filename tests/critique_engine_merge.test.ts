import { describe, it, expect } from "vitest";
import { mergeCritiqueNodeOutputs } from "@/lib/critique_engine/orchestration/merge_outputs";
import { segmentLyrics } from "@/lib/critique_engine/utils/lyric_segmentation";
import type { CritiqueRequestPayload } from "@/lib/prompts";

const minimalPayload = {
  fullText: "line one\nline two",
  title: "t",
  similarArtists: "",
  genre: "",
  mode: "deep" as const,
} satisfies CritiqueRequestPayload;

describe("mergeCritiqueNodeOutputs", () => {
  it("maps node outputs to legacy CritiqueResult shape", () => {
    const segmented = segmentLyrics(minimalPayload.fullText);
    const critique = mergeCritiqueNodeOutputs({
      payload: minimalPayload,
      genre: {
        normalizedGenres: ["pop"],
        normalizedInfluences: [],
        styleTraits: ["a", "b", "c"],
        songwritingPrinciples: ["p1", "p2", "p3", "p4"],
        evaluationLensSummary: "Lens one. Lens two.",
      },
      calibration: {
        overallRatingBand: "Promising",
        subscores: {
          emotionalImpact: 3,
          imagerySpecificity: 3,
          originalityVoice: 3,
          prosodySingability: 3,
          structureCohesion: 3,
          lyricalEconomy: 3,
          hookStrength: 3,
        },
        subscoreRationales: {
          emotionalImpact: "r1.",
          imagerySpecificity: "r2.",
          originalityVoice: "r3.",
          prosodySingability: "r4.",
          structureCohesion: "r5.",
          lyricalEconomy: "r6.",
          hookStrength: "r7.",
        },
        diagnosticSummaryShort: "Short diag.",
        calibrationConfidence: 0.72,
      },
      synthesis: {
        overallSummary: "Summary sentence one. Summary sentence two.",
        topStrengths: ["s1", "s2"],
        topWeaknesses: ["w1", "w2"],
        revisionPriorities: ["p1"],
        nextBandGuidance: "Next guidance here.",
      },
      lineAnnotations: [
        {
          lineIndexStart: 0,
          quotedText: "line one",
          label: "strong",
          feedbackType: "praise",
          commentary: "Works.",
        },
      ],
      segmented,
    });

    expect(critique.overallRatingBand).toBe("Promising");
    expect(critique.subscores.emotional_impact).toBe(3);
    expect(critique.overallStrengths).toEqual(["s1", "s2"]);
    expect(critique.lineFeedback[0]?.quotedLine).toBe("line one");
    expect(critique.diagnostics?.calibrationConfidence).toBe(0.72);
    expect(critique.genrePrinciples).toContain("Evaluation lens:");
  });
});
