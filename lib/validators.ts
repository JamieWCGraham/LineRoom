import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
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
