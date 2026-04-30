import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { critiqueRequestSchema } from "@/lib/validators";

/** Supabase may return `text[]` or JSON arrays for some columns; coerce to a single string. */
export const pgTextish = z
  .union([z.string(), z.array(z.string())])
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    if (Array.isArray(v)) {
      const parts = v.map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    const t = v.trim();
    return t.length > 0 ? t : null;
  });

/** Like `pgTextish`, but join array lines with newlines (for `text[]` lyrics). */
export const pgLyricsish = z
  .union([z.string(), z.array(z.string())])
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    if (Array.isArray(v)) {
      return v.length > 0 ? v.join("\n") : null;
    }
    const t = v.trim();
    return t.length > 0 ? v : null;
  });

export const evalSetRowSchema = z.object({
  id: z.number().int(),
  title: pgTextish,
  artist: pgTextish,
  lyrics: pgLyricsish,
  genre: pgTextish,
  overall_score: z.unknown().nullable(),
  ground_truth_subscores: z.unknown().nullable().optional(),
  ground_truth_subscores_approved: z.boolean().nullable().optional(),
  ground_truth_strengths_weaknesses: z.unknown().nullable().optional(),
  ground_truth_strengths_weaknesses_approved: z.boolean().nullable().optional(),
  ground_truth_line_feedback: z.unknown().nullable().optional(),
  ground_truth_line_feedback_approved: z.boolean().nullable().optional(),
});

export type ParsedEvalSetRow = z.infer<typeof evalSetRowSchema>;
export type CritiqueRequestPayload = z.infer<typeof critiqueRequestSchema>;

export function evalRowToCritiquePayload(
  row: ParsedEvalSetRow,
): CritiqueRequestPayload {
  const lyrics = row.lyrics?.trim() ?? "";
  return {
    fullText: lyrics,
    title: row.title?.trim() ?? "",
    similarArtists: row.artist?.trim() ?? "",
    genre: row.genre?.trim() ?? "",
  };
}

export async function fetchEvalSetRowById(
  admin: SupabaseClient,
  id: number,
): Promise<
  | { ok: true; row: ParsedEvalSetRow; requestPayload: CritiqueRequestPayload }
  | { ok: false; error: string; detail?: string }
> {
  const { data, error } = await admin
    .from("generate_critique_eval_set")
    .select(
      "id, title, artist, lyrics, genre, overall_score, ground_truth_subscores, ground_truth_subscores_approved, ground_truth_strengths_weaknesses, ground_truth_strengths_weaknesses_approved, ground_truth_line_feedback, ground_truth_line_feedback_approved",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Failed to load eval row", detail: error.message };
  }
  if (!data) {
    return { ok: false, error: "No row for id" };
  }

  const parsed = evalSetRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Eval row shape unexpected",
      detail: JSON.stringify(parsed.error.flatten()),
    };
  }

  const row = parsed.data;
  const lyrics = row.lyrics?.trim() ?? "";
  if (!lyrics) {
    return { ok: false, error: "Eval row has empty lyrics" };
  }

  return {
    ok: true,
    row,
    requestPayload: evalRowToCritiquePayload(row),
  };
}
