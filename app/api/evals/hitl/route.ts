import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateBaselineGroundTruthSubscores } from "@/lib/evals/subscoreJudge";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const baselineBodySchema = z.object({
  onlyMissing: z.boolean().default(true),
  limit: z.number().int().min(1).max(200).default(30),
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
      "id, title, artist, genre, lyrics, overall_score, ground_truth_subscores, ground_truth_subscores_approved",
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

  const { limit, onlyMissing } = parsed.data;
  let query = admin
    .from("generate_critique_eval_set")
    .select("id, title, artist, genre, lyrics, overall_score, ground_truth_subscores")
    .order("id", { ascending: true })
    .limit(limit);

  if (onlyMissing) {
    query = query.is("ground_truth_subscores", null);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingColumnError(error.message)) {
      return NextResponse.json(
        {
          error: "HITL schema columns missing",
          detail: "Run Supabase migrations to add ground_truth_subscores columns.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load rows for baseline generation", detail: error.message },
      { status: 500 },
    );
  }

  const results: Array<{ id: number; status: "updated" | "skipped" | "failed"; detail?: string }> = [];
  for (const row of data ?? []) {
    if (typeof row.id !== "number") continue;
    if (typeof row.lyrics !== "string" || !row.lyrics.trim()) {
      results.push({ id: row.id, status: "skipped", detail: "empty lyrics" });
      continue;
    }
    try {
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
    } catch (e) {
      results.push({
        id: row.id,
        status: "failed",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({ results });
}
