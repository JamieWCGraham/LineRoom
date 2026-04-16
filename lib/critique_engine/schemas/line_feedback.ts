import { z } from "zod";
import type { SegmentedLyric } from "@/lib/critique_engine/utils/lyric_segmentation";

export const lineFeedbackLabelSchema = z.enum(["strong", "promising", "weak"]);

const optionalNullableNumber = z
  .union([z.number().int().nonnegative(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? undefined : v));

const optionalNullableString = (max: number) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined ? undefined : v));

export const lineFeedbackItemSchema = z.object({
  lineIndexStart: z.number().int().nonnegative(),
  lineIndexEnd: optionalNullableNumber,
  quotedText: z.string().min(1).max(2000),
  label: lineFeedbackLabelSchema,
  feedbackType: z.enum(["praise", "suggestion", "mixed"]),
  issueCategory: optionalNullableString(120),
  commentary: z.string().min(4).max(1200),
  suggestedRevision: optionalNullableString(800),
  rewriteDirection: optionalNullableString(800),
});

export type LineFeedbackItem = z.infer<typeof lineFeedbackItemSchema>;

export type LineFeedbackAnnotationBounds = {
  /** Non-blank lyric lines (trimmed length > 0). */
  nonBlankLines: number;
  /** Total indexed lines including blanks. */
  indexedLines: number;
  min: number;
  max: number;
};

/**
 * Minimum annotations scale with draft size so short pieces are not impossible,
 * while normal drafts require a meaningful sparse pass (matches product spec).
 */
export function lineFeedbackAnnotationBounds(
  segmented: SegmentedLyric,
): LineFeedbackAnnotationBounds {
  const indexedLines = segmented.lines.length;
  const nonBlankLines = segmented.lines.filter((l) => l.text.trim().length > 0).length;
  let min: number;
  if (nonBlankLines <= 3) min = 1;
  else if (nonBlankLines <= 8) min = 2;
  else if (nonBlankLines <= 14) min = 3;
  else min = 4;
  return { nonBlankLines, indexedLines, min, max: 10 };
}

/** Dynamic schema so empty `annotations: []` fails validation and triggers JSON repair. */
export function buildLineFeedbackOutputSchema(segmented: SegmentedLyric) {
  const { min } = lineFeedbackAnnotationBounds(segmented);
  return z.object({
    annotations: z.array(lineFeedbackItemSchema).min(min).max(10),
  });
}

/** Loose schema for tests / callers that do not have segmented lyrics. */
export const lineFeedbackOutputSchema = z.object({
  annotations: z.array(lineFeedbackItemSchema).min(0).max(10),
});

export type LineFeedbackOutput = z.infer<typeof lineFeedbackOutputSchema>;
