import { describe, it, expect } from "vitest";
import { genreContextOutputSchema } from "@/lib/critique_engine/schemas/genre_context";
import {
  buildLineFeedbackOutputSchema,
  lineFeedbackAnnotationBounds,
} from "@/lib/critique_engine/schemas/line_feedback";
import { synthesisOutputSchema } from "@/lib/critique_engine/schemas/synthesis";
import { segmentLyrics } from "@/lib/critique_engine/utils/lyric_segmentation";

describe("critique_engine schemas", () => {
  it("accepts a valid genre context object", () => {
    const parsed = genreContextOutputSchema.safeParse({
      normalizedGenres: ["indie"],
      normalizedInfluences: ["x"],
      styleTraits: ["t1", "t2", "t3"],
      songwritingPrinciples: ["a", "b", "c", "d"],
      evaluationLensSummary: "One sentence. Two here.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects genre context with too few style traits", () => {
    const parsed = genreContextOutputSchema.safeParse({
      normalizedGenres: ["indie"],
      normalizedInfluences: [],
      styleTraits: ["t1", "t2"],
      songwritingPrinciples: ["a", "b", "c", "d"],
      evaluationLensSummary: "Too short",
    });
    expect(parsed.success).toBe(false);
  });

  it("line feedback bounds require annotations for a normal-length draft", () => {
    const seg = segmentLyrics(
      Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n"),
    );
    const bounds = lineFeedbackAnnotationBounds(seg);
    expect(bounds.min).toBeGreaterThanOrEqual(3);
    const schema = buildLineFeedbackOutputSchema(seg);
    expect(schema.safeParse({ annotations: [] }).success).toBe(false);
    const four = [0, 3, 7, 12].map((idx) => ({
      lineIndexStart: idx,
      quotedText: `line ${idx + 1}`,
      label: "promising" as const,
      feedbackType: "mixed" as const,
      commentary: "Note on this line.",
    }));
    expect(schema.safeParse({ annotations: four }).success).toBe(true);
  });

  it("accepts synthesis output within bounds", () => {
    const parsed = synthesisOutputSchema.safeParse({
      overallSummary: "A".repeat(25),
      topStrengths: ["strength one", "strength two"],
      topWeaknesses: ["weakness one", "weakness two"],
      revisionPriorities: ["priority one"],
      nextBandGuidance: "Guidance sentence is long enough.",
    });
    expect(parsed.success).toBe(true);
  });
});
