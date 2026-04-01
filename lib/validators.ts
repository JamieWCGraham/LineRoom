import { z } from "zod";
import { REWRITE_ACTIONS } from "./types";

const rewriteActionSchema = z.enum(REWRITE_ACTIONS);

export const rewriteRequestSchema = z.object({
  fullText: z.string(),
  selectedText: z.string().min(1, "selectedText is required"),
  action: rewriteActionSchema,
  customInstruction: z.string().optional(),
  voiceNotes: z.string().optional(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
});

export const critiqueRequestSchema = z.object({
  fullText: z.string(),
  selectedText: z.string().min(1, "selectedText is required"),
  voiceNotes: z.string().optional(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
});

export const rewriteOptionSchema = z.object({
  label: z.string(),
  rationale: z.string(),
  text: z.string(),
});

export const rewriteResponseSchema = z.object({
  options: z.array(rewriteOptionSchema).min(1),
});

export const critiqueResponseSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  strongestLine: z.string().optional(),
  weakestLine: z.string().optional(),
  clicheRisk: z.string().optional(),
  emotionalClarity: z.string().optional(),
  nextMove: z.string().optional(),
});
