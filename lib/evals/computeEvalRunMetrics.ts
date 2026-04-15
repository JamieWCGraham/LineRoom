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

export type GroundTruthRowMetrics = {
  id: number;
  title: string;
  artist: string;
  /** Raw / display value from `generate_critique_eval_set.overall_score`. */
  overallScore: string;
  isCorrect: boolean;
  predictedOverallScore: string | null;
};

export type EvalRunMetricsResult = {
  runId: string;
  totalCompared: number;
  totalCorrect: number;
  /** Exact-match accuracy over rows with valid gold + prediction. */
  totalAccuracy: number | null;
  byOverallScore: Record<CanonicalRatingBand, BandStratumMetrics>;
  /** Rows = ground truth band, columns = predicted band (counts of eval rows). */
  confusionMatrix: Record<CanonicalRatingBand, Record<CanonicalRatingBand, number>>;
  groundTruthRows: GroundTruthRowMetrics[];
  skipped: {
    missingOutput: number[];
    missingPrediction: number[];
    invalidGoldLabel: number[];
  };
};

function emptyStratum(): BandStratumMetrics {
  return { count: 0, correct: 0, accuracy: null };
}

function emptyConfusionRow(): Record<CanonicalRatingBand, number> {
  return Object.fromEntries(
    CANONICAL_RATING_BANDS.map((p) => [p, 0]),
  ) as Record<CanonicalRatingBand, number>;
}

function displayCell(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .join(", ");
  }
  return String(raw);
}

type RowWorkItem = { id: number; gold: CanonicalRatingBand };

type RowMetricOutcome =
  | {
      kind: "compared";
      id: number;
      gold: CanonicalRatingBand;
      predicted: CanonicalRatingBand;
      correct: boolean;
    }
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
    id,
    gold,
    predicted,
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
    .select("id, title, artist, overall_score")
    .order("id", { ascending: true });

  if (tableErr) {
    return { error: "Failed to load eval set", detail: tableErr.message };
  }

  const bucket = getLineRoomEvalsBucket();
  const byOverallScore = Object.fromEntries(
    CANONICAL_RATING_BANDS.map((b) => [b, emptyStratum()]),
  ) as Record<CanonicalRatingBand, BandStratumMetrics>;

  const confusionMatrix = Object.fromEntries(
    CANONICAL_RATING_BANDS.map((g) => [g, emptyConfusionRow()]),
  ) as Record<CanonicalRatingBand, Record<CanonicalRatingBand, number>>;

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

  const outcomeById = new Map<number, RowMetricOutcome>();
  for (const o of outcomes) {
    outcomeById.set(o.id, o);
  }

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
    confusionMatrix[o.gold][o.predicted] += 1;
  }

  for (const b of CANONICAL_RATING_BANDS) {
    const s = byOverallScore[b];
    s.accuracy = s.count > 0 ? s.correct / s.count : null;
  }

  const groundTruthRows: GroundTruthRowMetrics[] = [];
  for (const row of rows ?? []) {
    const id = typeof row.id === "number" ? row.id : Number.NaN;
    if (!Number.isInteger(id) || id < 1) continue;

    const title = displayCell(row.title);
    const artist = displayCell(row.artist);
    const overallScore = displayCell(row.overall_score);

    const o = outcomeById.get(id);
    let isCorrect = false;
    let predictedOverallScore: string | null = null;
    if (o?.kind === "compared") {
      predictedOverallScore = o.predicted;
      isCorrect = o.correct;
    }

    groundTruthRows.push({
      id,
      title,
      artist,
      overallScore,
      isCorrect,
      predictedOverallScore,
    });
  }

  return {
    runId,
    totalCompared,
    totalCorrect,
    totalAccuracy: totalCompared > 0 ? totalCorrect / totalCompared : null,
    byOverallScore,
    confusionMatrix,
    groundTruthRows,
    skipped: {
      missingOutput: missingOutput.sort((a, c) => a - c),
      missingPrediction: missingPrediction.sort((a, c) => a - c),
      invalidGoldLabel: invalidGoldLabel.sort((a, c) => a - c),
    },
  };
}
