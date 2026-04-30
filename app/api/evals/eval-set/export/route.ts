import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/evals/evalSongInput";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { pgLyricsish, pgTextish } from "@/lib/evals/evalSetRow";

const EXPORT_HEADERS = [
  "id",
  "title",
  "artist",
  "lyrics",
  "genre",
  "overall_score",
  "rationale_short",
  "ground_truth_subscores",
  "ground_truth_subscores_approved",
  "ground_truth_strengths_weaknesses",
  "ground_truth_strengths_weaknesses_approved",
  "ground_truth_line_feedback",
  "ground_truth_line_feedback_approved",
] as const;

function coerceText(raw: unknown): string {
  const r = pgTextish.safeParse(raw);
  return r.success && r.data ? r.data : "";
}

function coerceLyrics(raw: unknown): string {
  const r = pgLyricsish.safeParse(raw);
  return r.success && r.data ? r.data : "";
}

/**
 * Full evaluation set as CSV (billing-bypass sessions only).
 */
export async function GET() {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Config error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const pageSize = 1000;
  const all: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("generate_critique_eval_set")
      .select(
        "id, title, artist, lyrics, genre, overall_score, rationale_short, ground_truth_subscores, ground_truth_subscores_approved, ground_truth_strengths_weaknesses, ground_truth_strengths_weaknesses_approved, ground_truth_line_feedback, ground_truth_line_feedback_approved",
      )
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load eval set", detail: error.message },
        { status: 500 },
      );
    }
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const csvRows = all.map((row) => {
    const rationale = coerceText(row.rationale_short);
    const score =
      typeof row.overall_score === "string" ?
        row.overall_score
      : row.overall_score != null ?
        String(row.overall_score)
      : "";
    return [
      String(row.id ?? ""),
      coerceText(row.title),
      coerceText(row.artist),
      coerceLyrics(row.lyrics),
      coerceText(row.genre),
      score,
      rationale,
      row.ground_truth_subscores ? JSON.stringify(row.ground_truth_subscores) : "",
      typeof row.ground_truth_subscores_approved === "boolean" ?
        String(row.ground_truth_subscores_approved)
      : "",
      row.ground_truth_strengths_weaknesses ?
        JSON.stringify(row.ground_truth_strengths_weaknesses)
      : "",
      typeof row.ground_truth_strengths_weaknesses_approved === "boolean" ?
        String(row.ground_truth_strengths_weaknesses_approved)
      : "",
      row.ground_truth_line_feedback ? JSON.stringify(row.ground_truth_line_feedback) : "",
      typeof row.ground_truth_line_feedback_approved === "boolean" ?
        String(row.ground_truth_line_feedback_approved)
      : "",
    ];
  });

  const csv = rowsToCsv([...EXPORT_HEADERS], csvRows);
  const filename = `generate_critique_eval_set_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
