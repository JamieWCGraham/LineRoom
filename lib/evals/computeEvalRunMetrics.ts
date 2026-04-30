import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEvalMetricsConcurrency } from "./concurrency";
import { evalOutputObjectPath, getLineRoomEvalsBucket } from "./bucket";
import type { LyricDimension } from "@/lib/types";
import type { LineFeedbackItem } from "@/lib/types";
import { critiqueResultSchema, lyricSubscoresSchema } from "@/lib/validators";
import {
  evaluateSubscoreCalibration,
  parseGroundTruthSubscores,
  SUBSCORE_DIMENSIONS,
} from "./subscoreCalibration";
import {
  CANONICAL_RATING_BANDS,
  type CanonicalRatingBand,
  parseOverallRatingBandFromOutputJson,
  parseOverallScoreFromDb,
} from "./ratingBands";
import { runPool } from "./runPool";
import { parseGroundTruthStrengthsWeaknesses } from "./strengthWeaknessGroundTruth";
import {
  aggregateStrengthWeaknessRunMetrics,
  parseStrengthWeaknessEvalFromOutputJson,
  type StrengthWeaknessEvalSnapshot,
} from "./strengthWeaknessMetrics";
import {
  hasLineFeedbackGoldForJudge,
  parseGroundTruthLineFeedback,
} from "./lineFeedbackGroundTruth";
import {
  aggregateLineFeedbackRunMetrics,
  parseLineFeedbackEvalFromOutputJson,
  type LineFeedbackEvalSnapshot,
} from "./lineFeedbackMetrics";

export type StrengthWeaknessDrilldownStatus =
  | "ok"
  | "no_gold_reference"
  | "no_judge_in_output"
  | "missing_run_output"
  | "missing_prediction"
  | "invalid_gold_label";

export type StrengthWeaknessRowDrilldown = {
  status: StrengthWeaknessDrilldownStatus;
  goldStrengths: string[];
  goldWeaknesses: string[];
  predictedStrengths: string[];
  predictedWeaknesses: string[];
  judge: StrengthWeaknessEvalSnapshot | null;
};

export type LineFeedbackDrilldownStatus =
  | "ok"
  | "no_gold_reference"
  | "no_judge_in_output"
  | "missing_run_output"
  | "missing_prediction"
  | "invalid_gold_label";

export type LineFeedbackRowDrilldown = {
  status: LineFeedbackDrilldownStatus;
  goldMustLines: string[];
  goldOptionalLines: string[];
  predictedLineFeedback: LineFeedbackItem[];
  judge: LineFeedbackEvalSnapshot | null;
};

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
  /** Per-song gold vs this run + optional LLM judge snapshot (strength/weakness module). */
  strengthWeaknessDrilldown: StrengthWeaknessRowDrilldown;
  lineFeedbackDrilldown: LineFeedbackRowDrilldown;
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
  subscoreCalibration: {
    comparedRows: number;
    meanAbsoluteError: number | null;
    bandConsistencyPassRate: number | null;
    explanationAlignmentMean: number | null;
    byDimension: Record<
      LyricDimension,
      {
        meanAbsoluteError: number | null;
        withinToleranceRate: number | null;
        failureRate: number | null;
      }
    >;
  };
  strengthWeaknessCalibration: {
    comparedRows: number;
    meanSpecificity: number | null;
    meanEvidenceGrounding: number | null;
    meanNonRedundancy: number | null;
    meanActionability: number | null;
    meanFairness: number | null;
    meanCompositeRubric: number | null;
    failureFlagCounts: Record<string, number>;
  };
  lineFeedbackCalibration: {
    comparedRows: number;
    meanCoverage: number | null;
    meanLabelCalibration: number | null;
    meanSpecificity: number | null;
    meanRevisionUsefulness: number | null;
    meanContextAwareness: number | null;
    meanLineLevelComposite: number | null;
    failureFlagCounts: Record<string, number>;
  };
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

type RowWorkItem = {
  id: number;
  gold: CanonicalRatingBand;
  groundTruthSubscores: unknown;
  groundTruthStrengthsWeaknesses: unknown;
  groundTruthLineFeedback: unknown;
};

type RowMetricOutcome =
  | {
      kind: "compared";
      id: number;
      gold: CanonicalRatingBand;
      predicted: CanonicalRatingBand;
      correct: boolean;
      subscoreMae?: number;
      subscoreBandConsistencyPass?: boolean;
      explanationAlignmentScore?: number;
      perDimensionDistance?: Record<LyricDimension, number>;
      strengthWeaknessEval?: StrengthWeaknessEvalSnapshot | null;
      predictedStrengths: string[];
      predictedWeaknesses: string[];
      lineFeedbackEval: LineFeedbackEvalSnapshot | null;
      predictedLineFeedback: LineFeedbackItem[];
    }
  | { kind: "missingOutput"; id: number }
  | { kind: "missingPrediction"; id: number };

async function measureOneRow(
  client: SupabaseClient,
  bucket: string,
  runId: string,
  id: number,
  gold: CanonicalRatingBand,
  groundTruthSubscoresRaw: unknown,
  groundTruthStrengthsWeaknessesRaw: unknown,
  groundTruthLineFeedbackRaw: unknown,
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
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const critique = obj.critique;
  const critiqueObj =
    critique && typeof critique === "object" ? (critique as Record<string, unknown>) : null;
  const predictedSubscores = lyricSubscoresSchema.safeParse(critiqueObj?.subscores);
  const dbGroundTruth = parseGroundTruthSubscores(groundTruthSubscoresRaw);
  const subscoreCalibration =
    predictedSubscores.success && dbGroundTruth ?
      evaluateSubscoreCalibration({
        predicted: predictedSubscores.data,
        groundTruth: dbGroundTruth,
        overallBand: gold,
      })
    : null;
  const alignmentRaw = obj.subscoreCalibration;
  const explanationAlignmentScore =
    alignmentRaw && typeof alignmentRaw === "object" ?
      (alignmentRaw as { explanationAlignmentScore?: unknown }).explanationAlignmentScore
    : undefined;
  const maybeAlignment =
    typeof explanationAlignmentScore === "number" &&
      Number.isFinite(explanationAlignmentScore)
    ? explanationAlignmentScore
    : undefined;

  const gtSw = parseGroundTruthStrengthsWeaknesses(groundTruthStrengthsWeaknessesRaw);
  const strengthWeaknessEval =
    gtSw ? parseStrengthWeaknessEvalFromOutputJson(parsed) : null;

  const gtLf = parseGroundTruthLineFeedback(groundTruthLineFeedbackRaw);
  const lineFeedbackEval =
    gtLf && hasLineFeedbackGoldForJudge(gtLf) ?
      parseLineFeedbackEvalFromOutputJson(parsed)
    : null;

  const critParsed = critiqueResultSchema.safeParse(critiqueObj);
  const predictedStrengths = critParsed.success ? critParsed.data.overallStrengths : [];
  const predictedWeaknesses = critParsed.success ? critParsed.data.overallWeaknesses : [];
  const predictedLineFeedback = critParsed.success ? critParsed.data.lineFeedback : [];

  return {
    kind: "compared",
    id,
    gold,
    predicted,
    correct: predicted === gold,
    ...(subscoreCalibration ?
      {
        subscoreMae: subscoreCalibration.meanAbsoluteError,
        subscoreBandConsistencyPass: subscoreCalibration.bandConsistency === "pass",
        perDimensionDistance: subscoreCalibration.perDimensionDistance,
      }
    : {}),
    ...(maybeAlignment != null ? { explanationAlignmentScore: maybeAlignment } : {}),
    strengthWeaknessEval,
    predictedStrengths,
    predictedWeaknesses,
    lineFeedbackEval,
    predictedLineFeedback,
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
    .select(
      "id, title, artist, overall_score, ground_truth_subscores, ground_truth_strengths_weaknesses, ground_truth_line_feedback",
    )
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
    workItems.push({
      id,
      gold,
      groundTruthSubscores: row.ground_truth_subscores,
      groundTruthStrengthsWeaknesses: row.ground_truth_strengths_weaknesses,
      groundTruthLineFeedback: row.ground_truth_line_feedback,
    });
  }

  const outcomes: RowMetricOutcome[] = [];
  const concurrency = getEvalMetricsConcurrency();
  await runPool(
    workItems,
    concurrency,
    async ({
      id,
      gold,
      groundTruthSubscores,
      groundTruthStrengthsWeaknesses,
      groundTruthLineFeedback,
    }) => {
      const outcome = await measureOneRow(
        client,
        bucket,
        runId,
        id,
        gold,
        groundTruthSubscores,
        groundTruthStrengthsWeaknesses,
        groundTruthLineFeedback,
      );
      outcomes.push(outcome);
    },
  );

  const outcomeById = new Map<number, RowMetricOutcome>();
  for (const o of outcomes) {
    outcomeById.set(o.id, o);
  }

  let totalCompared = 0;
  let totalCorrect = 0;
  let subscoreComparedRows = 0;
  let subscoreMaeTotal = 0;
  let subscoreBandPassCount = 0;
  let explanationAlignmentCount = 0;
  let explanationAlignmentTotal = 0;
  const perDimDistanceSums = Object.fromEntries(
    SUBSCORE_DIMENSIONS.map((d) => [d, 0]),
  ) as Record<LyricDimension, number>;
  const perDimWithinToleranceCounts = Object.fromEntries(
    SUBSCORE_DIMENSIONS.map((d) => [d, 0]),
  ) as Record<LyricDimension, number>;
  const perDimFailureCounts = Object.fromEntries(
    SUBSCORE_DIMENSIONS.map((d) => [d, 0]),
  ) as Record<LyricDimension, number>;

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
    if (typeof o.subscoreMae === "number") {
      subscoreComparedRows += 1;
      subscoreMaeTotal += o.subscoreMae;
    }
    if (o.perDimensionDistance) {
      for (const dim of SUBSCORE_DIMENSIONS) {
        const d = o.perDimensionDistance[dim];
        perDimDistanceSums[dim] += d;
        if (d <= 1) perDimWithinToleranceCounts[dim] += 1;
        if (d >= 2) perDimFailureCounts[dim] += 1;
      }
    }
    if (o.subscoreBandConsistencyPass) {
      subscoreBandPassCount += 1;
    }
    if (typeof o.explanationAlignmentScore === "number") {
      explanationAlignmentCount += 1;
      explanationAlignmentTotal += o.explanationAlignmentScore;
    }
  }

  const strengthWeaknessSnapshots: Array<StrengthWeaknessEvalSnapshot | null> = [];
  const lineFeedbackSnapshots: Array<LineFeedbackEvalSnapshot | null> = [];
  for (const o of outcomes) {
    if (o.kind !== "compared") continue;
    strengthWeaknessSnapshots.push(o.strengthWeaknessEval ?? null);
    lineFeedbackSnapshots.push(o.lineFeedbackEval ?? null);
  }
  const strengthWeaknessCalibration = aggregateStrengthWeaknessRunMetrics(
    strengthWeaknessSnapshots,
  );
  const lineFeedbackCalibration = aggregateLineFeedbackRunMetrics(lineFeedbackSnapshots);

  for (const b of CANONICAL_RATING_BANDS) {
    const s = byOverallScore[b];
    s.accuracy = s.count > 0 ? s.correct / s.count : null;
  }

  const invalidGoldSet = new Set(invalidGoldLabel);

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

    const goldSw = parseGroundTruthStrengthsWeaknesses(row.ground_truth_strengths_weaknesses);
    const goldLf = parseGroundTruthLineFeedback(row.ground_truth_line_feedback);

    let strengthWeaknessDrilldown: StrengthWeaknessRowDrilldown;
    if (invalidGoldSet.has(id)) {
      strengthWeaknessDrilldown = {
        status: "invalid_gold_label",
        goldStrengths: goldSw?.overallStrengths ?? [],
        goldWeaknesses: goldSw?.overallWeaknesses ?? [],
        predictedStrengths: [],
        predictedWeaknesses: [],
        judge: null,
      };
    } else if (!o || o.kind === "missingOutput") {
      strengthWeaknessDrilldown = {
        status: "missing_run_output",
        goldStrengths: goldSw?.overallStrengths ?? [],
        goldWeaknesses: goldSw?.overallWeaknesses ?? [],
        predictedStrengths: [],
        predictedWeaknesses: [],
        judge: null,
      };
    } else if (o.kind === "missingPrediction") {
      strengthWeaknessDrilldown = {
        status: "missing_prediction",
        goldStrengths: goldSw?.overallStrengths ?? [],
        goldWeaknesses: goldSw?.overallWeaknesses ?? [],
        predictedStrengths: [],
        predictedWeaknesses: [],
        judge: null,
      };
    } else {
      const judge = o.strengthWeaknessEval ?? null;
      const status: StrengthWeaknessDrilldownStatus =
        !goldSw ? "no_gold_reference"
        : judge ? "ok"
        : "no_judge_in_output";
      strengthWeaknessDrilldown = {
        status,
        goldStrengths: goldSw?.overallStrengths ?? [],
        goldWeaknesses: goldSw?.overallWeaknesses ?? [],
        predictedStrengths: o.predictedStrengths,
        predictedWeaknesses: o.predictedWeaknesses,
        judge,
      };
    }

    let lineFeedbackDrilldown: LineFeedbackRowDrilldown;
    if (invalidGoldSet.has(id)) {
      lineFeedbackDrilldown = {
        status: "invalid_gold_label",
        goldMustLines: goldLf?.mustCommentLines ?? [],
        goldOptionalLines: goldLf?.optionalCommentLines ?? [],
        predictedLineFeedback: [],
        judge: null,
      };
    } else if (!o || o.kind === "missingOutput") {
      lineFeedbackDrilldown = {
        status: "missing_run_output",
        goldMustLines: goldLf?.mustCommentLines ?? [],
        goldOptionalLines: goldLf?.optionalCommentLines ?? [],
        predictedLineFeedback: [],
        judge: null,
      };
    } else if (o.kind === "missingPrediction") {
      lineFeedbackDrilldown = {
        status: "missing_prediction",
        goldMustLines: goldLf?.mustCommentLines ?? [],
        goldOptionalLines: goldLf?.optionalCommentLines ?? [],
        predictedLineFeedback: [],
        judge: null,
      };
    } else {
      const judgeLf = o.lineFeedbackEval ?? null;
      const hasGoldLf = goldLf != null && hasLineFeedbackGoldForJudge(goldLf);
      const status: LineFeedbackDrilldownStatus =
        !hasGoldLf ? "no_gold_reference"
        : judgeLf ? "ok"
        : "no_judge_in_output";
      lineFeedbackDrilldown = {
        status,
        goldMustLines: goldLf?.mustCommentLines ?? [],
        goldOptionalLines: goldLf?.optionalCommentLines ?? [],
        predictedLineFeedback: o.predictedLineFeedback,
        judge: judgeLf,
      };
    }

    groundTruthRows.push({
      id,
      title,
      artist,
      overallScore,
      isCorrect,
      predictedOverallScore,
      strengthWeaknessDrilldown,
      lineFeedbackDrilldown,
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
    subscoreCalibration: {
      comparedRows: subscoreComparedRows,
      meanAbsoluteError:
        subscoreComparedRows > 0 ? subscoreMaeTotal / subscoreComparedRows : null,
      bandConsistencyPassRate:
        subscoreComparedRows > 0 ? subscoreBandPassCount / subscoreComparedRows : null,
      explanationAlignmentMean:
        explanationAlignmentCount > 0 ?
          explanationAlignmentTotal / explanationAlignmentCount
        : null,
      byDimension: Object.fromEntries(
        SUBSCORE_DIMENSIONS.map((dim) => [
          dim,
          {
            meanAbsoluteError:
              subscoreComparedRows > 0 ?
                perDimDistanceSums[dim] / subscoreComparedRows
              : null,
            withinToleranceRate:
              subscoreComparedRows > 0 ?
                perDimWithinToleranceCounts[dim] / subscoreComparedRows
              : null,
            failureRate:
              subscoreComparedRows > 0 ?
                perDimFailureCounts[dim] / subscoreComparedRows
              : null,
          },
        ]),
      ) as Record<
        LyricDimension,
        {
          meanAbsoluteError: number | null;
          withinToleranceRate: number | null;
          failureRate: number | null;
        }
      >,
    },
    strengthWeaknessCalibration,
    lineFeedbackCalibration,
    skipped: {
      missingOutput: missingOutput.sort((a, c) => a - c),
      missingPrediction: missingPrediction.sort((a, c) => a - c),
      invalidGoldLabel: invalidGoldLabel.sort((a, c) => a - c),
    },
  };
}
