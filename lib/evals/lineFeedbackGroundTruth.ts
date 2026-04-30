import { z } from "zod";

export const lineStrengthBandSchema = z.enum(["strong", "promising", "suggestion"]);

export const groundTruthAnchorLineSchema = z.object({
  quotedLine: z.string(),
  role: z.string().optional(),
  expectedStrength: lineStrengthBandSchema.optional(),
  rationale: z.string().optional(),
});

/** HITL / baseline reference for line-level feedback quality (must-hit lines + anchors). */
export const groundTruthLineFeedbackSchema = z.object({
  mustCommentLines: z.array(z.string()),
  optionalCommentLines: z.array(z.string()),
  anchorLines: z.array(groundTruthAnchorLineSchema),
});

export type GroundTruthLineFeedback = z.infer<typeof groundTruthLineFeedbackSchema>;
export type GroundTruthAnchorLine = z.infer<typeof groundTruthAnchorLineSchema>;

export function parseGroundTruthLineFeedback(raw: unknown): GroundTruthLineFeedback | null {
  const parsed = groundTruthLineFeedbackSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function emptyGroundTruthLineFeedback(): GroundTruthLineFeedback {
  return { mustCommentLines: [], optionalCommentLines: [], anchorLines: [] };
}

/** Enough reference material to run the LLM judge. */
export function hasLineFeedbackGoldForJudge(gt: GroundTruthLineFeedback | null): boolean {
  if (!gt) return false;
  if (gt.mustCommentLines.some((s) => s.trim())) return true;
  if (gt.anchorLines.some((a) => a.quotedLine.trim())) return true;
  return false;
}
