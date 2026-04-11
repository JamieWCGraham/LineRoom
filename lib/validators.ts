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

export const lineFeedbackItemSchema = z.object({
  quotedLine: z.string(),
  feedback: z.string(),
  category: z.enum(["praise", "constructive"]).default("constructive"),
  strength: z.enum(["strong", "promising", "weak"]).optional(),
});

export const overallRatingBandSchema = z.enum([
  "Needs Work",
  "Promising",
  "Strong",
  "Standout",
]);

export const dimensionScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const lyricSubscoresSchema = z.object({
  emotional_impact: dimensionScoreSchema,
  imagery_specificity: dimensionScoreSchema,
  originality_voice: dimensionScoreSchema,
  prosody_singability: dimensionScoreSchema,
  structure_cohesion: dimensionScoreSchema,
  lyrical_economy: dimensionScoreSchema,
  hook_strength: dimensionScoreSchema,
});

export const critiqueResultSchema = z.object({
  genrePrinciples: z.string(),
  overallRatingBand: overallRatingBandSchema,
  overallBandRationale: z.string().optional(),
  subscores: lyricSubscoresSchema,
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
  lineFeedback: z.array(lineFeedbackItemSchema),
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

export const chatRequestSchema = z.object({
  fullText: z.string(),
  pieceTitle: z.string().optional(),
  messages: z.array(chatMessageSchema).max(80),
  critique: critiqueResultSchema.optional(),
  critiqueMeta: z
    .object({
      title: z.string(),
      similarArtists: z.string(),
      genre: z.string(),
    })
    .optional(),
  chatAction: chatActionPayloadSchema.optional(),
});

export const critiqueMetaSchema = z.object({
  title: z.string(),
  similarArtists: z.string(),
  genre: z.string(),
});

export const saveSongVersionPayloadSchema = z.object({
  draft_text: z.string(),
  chat_messages: z.array(chatMessageSchema).max(120),
  critique: critiqueResultSchema.nullable(),
  meta: critiqueMetaSchema,
});
