import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const lineFeedbackItemSchema = z.object({
  quotedLine: z.string(),
  feedback: z.string(),
});

export const critiqueResultSchema = z.object({
  genrePrinciples: z.string(),
  score: z.number().min(0).max(10),
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
  lineFeedback: z.array(lineFeedbackItemSchema),
});

export const critiqueRequestSchema = z.object({
  fullText: z.string().min(1, "Lyrics are required"),
  title: z.string(),
  similarArtists: z.string(),
  genre: z.string(),
});

export const chatRequestSchema = z.object({
  fullText: z.string(),
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
