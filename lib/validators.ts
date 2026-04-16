import { z } from "zod";

export const chatActionResponseSchema = z.object({
  mode: z.enum([
    "find_rhymes",
    "suggest_rewrites",
    "diagnose",
    "rewrite",
    "hook",
  ]),
  scope: z.enum(["selection", "section", "full_draft"]),
  summary: z.string(),
  diagnosis: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  recommendedOption: z.number().int().nullable().optional(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  structured: chatActionResponseSchema.optional(),
});

/**
 * Normalise a model-returned enum string: lowercase + trim.
 * Prevents __BAD_SHAPE__ from simple casing inconsistencies (e.g. "Praise").
 */
function lc(v: unknown): unknown {
  return typeof v === "string" ? v.toLowerCase().trim() : v;
}

export const lineFeedbackItemSchema = z.object({
  quotedLine: z.string(),
  feedback: z.string(),
  // Accept any casing from the model ("Praise", "CONSTRUCTIVE", etc.)
  category: z
    .preprocess(lc, z.enum(["praise", "constructive"]))
    .default("constructive"),
  // Accept any casing ("Strong", "Promising") and common aliases for "weak"
  // ("Room for Improvement", "Needs Improvement", etc.)
  strength: z
    .preprocess((v) => {
      if (typeof v !== "string") return v;
      const s = v.toLowerCase().trim();
      if (s === "strong") return "strong";
      if (s === "promising") return "promising";
      if (s === "weak" || s.includes("improve") || s.includes("room")) {
        return "weak";
      }
      return s;
    }, z.enum(["strong", "promising", "weak"]))
    .optional(),
});

/**
 * Accept any casing of the band name from the model.
 * e.g. "needs work", "STANDOUT", "Strong" all normalise to the canonical form.
 */
const BAND_ALIAS: Record<string, string> = {
  "needs work": "Needs Work",
  "needswork": "Needs Work",
  promising: "Promising",
  strong: "Strong",
  standout: "Standout",
};
export const overallRatingBandSchema = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const key = v.toLowerCase().trim().replace(/\s+/g, " ");
  return BAND_ALIAS[key] ?? v;
}, z.enum(["Needs Work", "Promising", "Strong", "Standout"]));

/**
 * Accept scores from the model that are slightly out-of-range (0, 6) or
 * fractional (3.7) by rounding and clamping to 1–5.
 */
export const dimensionScoreSchema = z.preprocess((v) => {
  if (typeof v !== "number") return v;
  return Math.max(1, Math.min(5, Math.round(v)));
}, z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]));

export const lyricSubscoresSchema = z.object({
  emotional_impact: dimensionScoreSchema,
  imagery_specificity: dimensionScoreSchema,
  originality_voice: dimensionScoreSchema,
  prosody_singability: dimensionScoreSchema,
  structure_cohesion: dimensionScoreSchema,
  lyrical_economy: dimensionScoreSchema,
  hook_strength: dimensionScoreSchema,
});

export const critiqueDiagnosticsSchema = z.object({
  diagnosticSummaryShort: z.string(),
  calibrationConfidence: z.number(),
  subscoreRationales: z.record(z.string()),
});

export const critiqueResultSchema = z.object({
  genrePrinciples: z.string(),
  overallRatingBand: overallRatingBandSchema,
  overallBandRationale: z.string().optional(),
  subscores: lyricSubscoresSchema,
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
  lineFeedback: z.array(lineFeedbackItemSchema),
  diagnostics: critiqueDiagnosticsSchema.optional(),
  analyzedSongVersion: z.number().int().positive().optional(),
  priorSongVersionCompared: z.number().int().positive().nullable().optional(),
  comparedToSummary: z.string().optional(),
});

export const chatSelectionPayloadSchema = z.object({
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  text: z.string(),
});

export const chatActionPayloadSchema = z.object({
  action: z.enum(["find_rhymes", "suggest_rewrites", "diagnose"]),
  scope: z.enum(["selection", "section", "full_draft"]),
  userMessage: z.string(),
  draft: z.string(),
  critique: critiqueResultSchema.optional(),
  selections: z.array(chatSelectionPayloadSchema).max(16).optional(),
  section: z
    .object({
      type: z.string(),
      text: z.string(),
    })
    .optional(),
});

export const critiqueRequestSchema = z.object({
  fullText: z.string().min(1, "Lyrics or poetry are required"),
  title: z.string(),
  similarArtists: z.string(),
  genre: z.string(),
  /** `fast` skips line-level node when the multi-node engine is enabled. */
  mode: z.enum(["fast", "deep"]).optional().default("deep"),
  /** True when replacing an existing critique (UI: Regenerate Critique). */
  regenerate: z.boolean().optional(),
  /** Critique in effect before regeneration; used for comparative rationale. */
  priorCritique: critiqueResultSchema.optional(),
  priorVersions: z
    .array(
      z.object({
        versionNumber: z.number().int().positive(),
        draftText: z.string(),
        critique: critiqueResultSchema.nullable(),
      }),
    )
    .max(8)
    .optional(),
  /** Song version row the current draft belongs to (LineRoom). */
  analyzedSongVersion: z.number().int().positive().optional(),
  /** Latest older saved version used as comparison context; null if none. */
  priorSongVersionCompared: z.number().int().positive().nullable().optional(),
});

export const draftRecordingMetaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  objectPath: z.string().max(512),
  mimeType: z.string().min(1).max(120),
  durationSec: z.number().min(0).max(86_400).optional(),
  createdAt: z.string().min(1).max(80),
});

export const critiqueMetaSchema = z.object({
  title: z.string(),
  similarArtists: z.string(),
  genre: z.string(),
  draftRecordings: z.array(draftRecordingMetaSchema).max(40).optional(),
});

export const chatRequestSchema = z.object({
  fullText: z.string(),
  pieceTitle: z.string().optional(),
  messages: z.array(chatMessageSchema).max(80),
  critique: critiqueResultSchema.optional(),
  critiqueMeta: critiqueMetaSchema.optional(),
  chatAction: chatActionPayloadSchema.optional(),
});

export const saveSongVersionPayloadSchema = z.object({
  draft_text: z.string(),
  brainstorm_text: z.string(),
  chat_messages: z.array(chatMessageSchema).max(120),
  critique: critiqueResultSchema.nullable(),
  meta: critiqueMetaSchema,
});
