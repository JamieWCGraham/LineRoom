import { z } from "zod";

export const synthesisOutputSchema = z.object({
  overallSummary: z.string().min(20).max(1200),
  topStrengths: z.array(z.string().min(4)).min(2).max(4),
  topWeaknesses: z.array(z.string().min(4)).min(2).max(4),
  revisionPriorities: z.array(z.string().min(4)).min(1).max(3),
  nextBandGuidance: z.string().min(12).max(520),
});

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>;
