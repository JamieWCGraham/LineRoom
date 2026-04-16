import { z } from "zod";

export const genreContextOutputSchema = z.object({
  normalizedGenres: z.array(z.string().min(1)).min(1).max(12),
  normalizedInfluences: z.array(z.string().min(1)).max(16),
  styleTraits: z.array(z.string().min(1)).min(3).max(8),
  songwritingPrinciples: z.array(z.string().min(1)).min(4).max(8),
  evaluationLensSummary: z.string().min(8).max(520),
});

export type GenreContextOutput = z.infer<typeof genreContextOutputSchema>;
