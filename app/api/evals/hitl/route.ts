import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateBaselineGroundTruthSubscores } from "@/lib/evals/subscoreJudge";
import { generateBaselineGroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessJudge";
import { generateBaselineGroundTruthLineFeedback } from "@/lib/evals/lineFeedbackJudge";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

const baselineBodySchema = z.object({
  onlyMissing: z.boolean().default(true),
  /** Max rows to process; omit to process every matching row (paginated, up to 50k). */
  limit: z.number().int().min(1).max(50_000).optional(),
  target: z
    .enum(["subscores", "strengths_weaknesses", "line_feedback"])
    .default("subscores"),
});

function isMissingColumnError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

export async function GET(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 503 },
    );
  }

  const { limit, offset } = parsed.data;
  const { data, error } = await admin
    .from("generate_critique_eval_set")
    .select(
      "id, title, artist, genre, lyrics, overall_score, ground_truth_subscores, ground_truth_subscores_approved, ground_truth_strengths_weaknesses, ground_truth_strengths_weaknesses_approved, ground_truth_line_feedback, ground_truth_line_feedback_approved",
    )
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    if (isMissingColumnError(error.message)) {
      const fallback = await admin
        .from("generate_critique_eval_set")
        .select("id, title, artist, genre, lyrics, overall_score")
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      if (fallback.error) {
        return NextResponse.json(
          { error: "Failed to load HITL rows", detail: fallback.error.message },
          { status: 500 },
        );
      }
      const rows = (fallback.data ?? []).map((r) => ({
        ...r,
        ground_truth_subscores: null,
        ground_truth_subscores_approved: false,
        ground_truth_strengths_weaknesses: null,
        ground_truth_strengths_weaknesses_approved: false,
        ground_truth_line_feedback: null,
        ground_truth_line_feedback_approved: false,
      }));
      return NextResponse.json({
        rows,
        migrationRequired: true,
        message:
          "HITL ground truth columns are missing. Apply latest Supabase migrations.",
      });
    }
    return NextResponse.json(
      { error: "Failed to load HITL rows", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = baselineBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 503 },
    );
  }

  const { limit: limitCap, onlyMissing, target } = parsed.data;
  const maxToProcess = limitCap ?? 50_000;
  const selectCols =
    target === "subscores" ?
      "id, title, artist, genre, lyrics, overall_score, ground_truth_subscores"
    : target === "strengths_weaknesses" ?
      "id, title, artist, genre, lyrics, overall_score, ground_truth_strengths_weaknesses"
    : "id, title, artist, genre, lyrics, overall_score, ground_truth_line_feedback";

  const PAGE = 200;
  type BaselineRow = {
    id: number;
    title?: string | null;
    artist?: string | null;
    genre?: string | null;
    lyrics?: string | null;
    overall_score?: string | null;
  };
  const collected: BaselineRow[] = [];

  for (let offset = 0; collected.length < maxToProcess; offset += PAGE) {
    const take = Math.min(PAGE, maxToProcess - collected.length);
    let q = admin
      .from("generate_critique_eval_set")
      .select(selectCols)
      .order("id", { ascending: true })
      .range(offset, offset + take - 1);

    if (onlyMissing) {
      q =
        target === "subscores" ?
          q.is("ground_truth_subscores", null)
        : target === "strengths_weaknesses" ?
          q.is("ground_truth_strengths_weaknesses", null)
        : q.is("ground_truth_line_feedback", null);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingColumnError(error.message)) {
        return NextResponse.json(
          {
            error: "HITL schema columns missing",
            detail: "Run Supabase migrations to add ground-truth annotation columns.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Failed to load rows for baseline generation", detail: error.message },
        { status: 500 },
      );
    }

    const chunk = (data ?? []) as BaselineRow[];
    for (const row of chunk) {
      collected.push(row);
      if (collected.length >= maxToProcess) break;
    }
    if (collected.length >= maxToProcess) break;
    if (chunk.length < take) break;
  }

  const results: Array<{ id: number; status: "updated" | "skipped" | "failed"; detail?: string }> = [];
  for (const row of collected) {
    if (typeof row.id !== "number") continue;
    if (typeof row.lyrics !== "string" || !row.lyrics.trim()) {
      results.push({ id: row.id, status: "skipped", detail: "empty lyrics" });
      continue;
    }
    try {
      if (target === "line_feedback") {
        const baseline = await generateBaselineGroundTruthLineFeedback({
          title: typeof row.title === "string" ? row.title : null,
          artist: typeof row.artist === "string" ? row.artist : null,
          genre: typeof row.genre === "string" ? row.genre : null,
          lyrics: row.lyrics,
          overallScore: typeof row.overall_score === "string" ? row.overall_score : null,
        });
        const { error: updateError } = await admin
          .from("generate_critique_eval_set")
          .update({
            ground_truth_line_feedback: baseline,
            ground_truth_line_feedback_approved: false,
          })
          .eq("id", row.id);
        if (updateError) {
          results.push({ id: row.id, status: "failed", detail: updateError.message });
        } else {
          results.push({ id: row.id, status: "updated" });
        }
      } else if (target === "subscores") {
        const baseline = await generateBaselineGroundTruthSubscores({
          title: typeof row.title === "string" ? row.title : null,
          artist: typeof row.artist === "string" ? row.artist : null,
          genre: typeof row.genre === "string" ? row.genre : null,
          lyrics: row.lyrics,
          overallScore: typeof row.overall_score === "string" ? row.overall_score : null,
        });
        const { error: updateError } = await admin
          .from("generate_critique_eval_set")
          .update({
            ground_truth_subscores: baseline.subscores,
            ground_truth_subscores_approved: false,
          })
          .eq("id", row.id);
        if (updateError) {
          results.push({ id: row.id, status: "failed", detail: updateError.message });
        } else {
          results.push({ id: row.id, status: "updated" });
        }
      } else {
        const baseline = await generateBaselineGroundTruthStrengthsWeaknesses({
          title: typeof row.title === "string" ? row.title : null,
          artist: typeof row.artist === "string" ? row.artist : null,
          genre: typeof row.genre === "string" ? row.genre : null,
          lyrics: row.lyrics,
          overallScore: typeof row.overall_score === "string" ? row.overall_score : null,
        });
        const { error: updateError } = await admin
          .from("generate_critique_eval_set")
          .update({
            ground_truth_strengths_weaknesses: baseline,
            ground_truth_strengths_weaknesses_approved: false,
          })
          .eq("id", row.id);
        if (updateError) {
          results.push({ id: row.id, status: "failed", detail: updateError.message });
        } else {
          results.push({ id: row.id, status: "updated" });
        }
      }
    } catch (e) {
      results.push({
        id: row.id,
        status: "failed",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    results,
    candidateRowCount: collected.length,
    maxToProcess,
  });
}
