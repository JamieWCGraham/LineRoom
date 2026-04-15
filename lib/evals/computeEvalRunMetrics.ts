import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEvalMetricsConcurrency } from "./concurrency";
import { evalOutputObjectPath, getLineRoomEvalsBucket } from "./bucket";
import {
  CANONICAL_RATING_BANDS,
  type CanonicalRatingBand,
  parseOverallRatingBandFromOutputJson,
  parseOverallScoreFromDb,
} from "./ratingBands";
import { runPool } from "./runPool";

export type BandStratumMetrics = {
  count: number;
  correct: number;
  accuracy: number | null;
};

export type EvalRunMetricsResult = {
  runId: string;
  totalCompared: number;
  totalCorrect: number;
  /** Exact-match accuracy over rows with valid gold + prediction. */
  totalAccuracy: number | null;
  byOverallScore: Record<CanonicalRatingBand, BandStratumMetrics>;
  skipped: {
    missingOutput: number[];
    missingPrediction: number[];
    invalidGoldLabel: number[];
  };
};

function emptyStratum(): BandStratumMetrics {
  return { count: 0, correct: 0, accuracy: null };
}

type RowWorkItem = { id: number; gold: CanonicalRatingBand };

type RowMetricOutcome =
  | { kind: "compared"; gold: CanonicalRatingBand; correct: boolean }
  | { kind: "missingOutput"; id: number }
  | { kind: "missingPrediction"; id: number };

async function measureOneRow(
  client: SupabaseClient,
  bucket: string,
  runId: string,
  id: number,
  gold: CanonicalRatingBand,
): Promise<RowMetricOutcome> {
  const path = evalOutputObjectPath(runId, id);
  const { data: blob, error: dlErr } = await client.storage
    .from(bucket)
    .download(path);

  if (dlErr || !blob) {
    return { kind: "missingOutput", id };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await blob.text()) as unknown;
  } catch {
    return { kind: "missingPrediction", id };
  }

  const predicted = parseOverallRatingBandFromOutputJson(parsed);
  if (!predicted) {
    return { kind: "missingPrediction", id };
  }

  return {
    kind: "compared",
    gold,
    correct: predicted === gold,
  };
}

/**
 * Compares stored `output.json` overall bands to `generate_critique_eval_set.overall_score`
 * for each eval row id. Storage downloads run in parallel (see `LINE_ROOM_EVAL_METRICS_CONCURRENCY`).
 */
export async function computeEvalRunMetrics(
  runId: string,
  admin?: SupabaseClient,
): Promise<EvalRunMetricsResult | { error: string; detail?: string }> {
  let client: SupabaseClient;
  try {
    client = admin ?? createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return { error: "Supabase service role not configured", detail: msg };
  }

  const { data: rows, error: tableErr } = await client
    .from("generate_critique_eval_set")
    .select("id, overall_score")
    .order("id", { ascending: true });

  if (tableErr) {
    return { error: "Failed to load eval set", detail: tableErr.message };
  }

  const bucket = getLineRoomEvalsBucket();
  const byOverallScore = Object.fromEntries(
    CANONICAL_RATING_BANDS.map((b) => [b, emptyStratum()]),
  ) as Record<CanonicalRatingBand, BandStratumMetrics>;

  const missingOutput: number[] = [];
  const missingPrediction: number[] = [];
  const invalidGoldLabel: number[] = [];

  const workItems: RowWorkItem[] = [];
  for (const row of rows ?? []) {
    const id = typeof row.id === "number" ? row.id : Number.NaN;
    if (!Number.isInteger(id) || id < 1) continue;

    const gold = parseOverallScoreFromDb(row.overall_score);
    if (!gold) {
      invalidGoldLabel.push(id);
      continue;
    }
    workItems.push({ id, gold });
  }

  const outcomes: RowMetricOutcome[] = [];
  const concurrency = getEvalMetricsConcurrency();
  await runPool(workItems, concurrency, async ({ id, gold }) => {
    const outcome = await measureOneRow(client, bucket, runId, id, gold);
    outcomes.push(outcome);
  });

  let totalCompared = 0;
  let totalCorrect = 0;

  for (const o of outcomes) {
    if (o.kind === "missingOutput") {
      missingOutput.push(o.id);
      continue;
    }
    if (o.kind === "missingPrediction") {
      missingPrediction.push(o.id);
      continue;
    }
    totalCompared += 1;
    if (o.correct) totalCorrect += 1;
    const stratum = byOverallScore[o.gold];
    stratum.count += 1;
    if (o.correct) stratum.correct += 1;
  }

  for (const b of CANONICAL_RATING_BANDS) {
    const s = byOverallScore[b];
    s.accuracy = s.count > 0 ? s.correct / s.count : null;
  }

  return {
    runId,
    totalCompared,
    totalCorrect,
    totalAccuracy: totalCompared > 0 ? totalCorrect / totalCompared : null,
    byOverallScore,
    skipped: {
      missingOutput: missingOutput.sort((a, c) => a - c),
      missingPrediction: missingPrediction.sort((a, c) => a - c),
      invalidGoldLabel: invalidGoldLabel.sort((a, c) => a - c),
    },
  };
}
