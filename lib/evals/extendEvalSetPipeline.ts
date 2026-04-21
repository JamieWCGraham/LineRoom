import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvalSongInput } from "@/lib/evals/evalSongInput";
import { genreToDbColumn } from "@/lib/evals/evalSongInput";
import { fetchSongLyrics } from "@/lib/evals/fetchSongLyrics";

export type ExtendEvalRowResult =
  | {
      status: "inserted";
      title: string;
      artist: string;
      id: number;
    }
  | {
      status: "failed";
      title: string;
      artist: string;
      error: string;
    };

export async function extendEvalSetWithLyrics(
  admin: SupabaseClient,
  rows: EvalSongInput[],
  options?: { fetchLyrics?: typeof fetchSongLyrics },
): Promise<ExtendEvalRowResult[]> {
  const fetchLyrics = options?.fetchLyrics ?? fetchSongLyrics;
  const results: ExtendEvalRowResult[] = [];

  for (const row of rows) {
    const lyrics = await fetchLyrics(row.title.trim(), row.artist.trim());
    if (!lyrics) {
      results.push({
        status: "failed",
        title: row.title.trim(),
        artist: row.artist.trim(),
        error: "Lyrics not found (lyrics.ovh and LRCLIB search).",
      });
      continue;
    }

    const { data, error } = await admin
      .from("generate_critique_eval_set")
      .insert({
        title: row.title.trim(),
        artist: row.artist.trim(),
        lyrics,
        genre: genreToDbColumn(row.genre),
        overall_score: row.overall_score.trim(),
        rationale_short: row.rationale_short.trim(),
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      results.push({
        status: "failed",
        title: row.title.trim(),
        artist: row.artist.trim(),
        error: error?.message ?? "Insert failed",
      });
      continue;
    }

    results.push({
      status: "inserted",
      title: row.title.trim(),
      artist: row.artist.trim(),
      id: data.id as number,
    });
  }

  return results;
}
