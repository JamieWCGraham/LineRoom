import type { SupabaseClient } from "@supabase/supabase-js";
import { runCritiqueModel } from "@/lib/critique/runCritiqueModel";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CritiqueResult } from "@/lib/types";
import { getEvalBatchConcurrency } from "./concurrency";
import { evalOutputObjectPath, getLineRoomEvalsBucket } from "./bucket";
import { parseOverallScoreFromDb } from "./ratingBands";
import {
  evaluateSubscoreCalibration,
  getCritiqueExplanationText,
  parseGroundTruthSubscores,
  type SubscoreCalibrationResult,
} from "./subscoreCalibration";
import { judgeSubscoreExplanationAlignment } from "./subscoreJudge";
import {
  fetchEvalSetRowById,
  type ParsedEvalSetRow,
  type CritiqueRequestPayload,
} from "./evalSetRow";
import { runPool } from "./runPool";

export type LineRoomEvalOutputFile = {
  runTimestamp: string;
  source: "eval_set";
  evalSetId: number;
  evalRow: ParsedEvalSetRow | null;
  requestPayload: CritiqueRequestPayload | null;
  userPrompt?: string;
  critique?: CritiqueResult;
  subscoreCalibration?: (SubscoreCalibrationResult & {
    explanationAlignmentScore?: number;
    explanationAlignmentNotes?: string;
  }) | null;
  elapsedMs?: number;
  error?: string | null;
};

async function uploadOutput(
  path: string,
  body: LineRoomEvalOutputFile,
): Promise<void> {
  const admin = createServiceRoleClient();
  const bucket = getLineRoomEvalsBucket();
  const json = JSON.stringify(body, null, 2);
  const { error } = await admin.storage.from(bucket).upload(path, json, {
    contentType: "application/json; charset=utf-8",
    upsert: true,
  });
  if (error) {
    console.error("[runEvalBatch] upload", path, error.message);
  }
}

async function processOneEvalRow(
  admin: SupabaseClient,
  runTimestamp: string,
  evalSetId: number,
): Promise<void> {
  const path = evalOutputObjectPath(runTimestamp, evalSetId);
  const base: LineRoomEvalOutputFile = {
    runTimestamp,
    source: "eval_set",
    evalSetId,
    evalRow: null,
    requestPayload: null,
    error: null,
  };

  const loaded = await fetchEvalSetRowById(admin, evalSetId);
  if (!loaded.ok) {
    await uploadOutput(path, {
      ...base,
      error: loaded.detail ?? loaded.error,
    });
    return;
  }

  const { row, requestPayload } = loaded;
  const started = Date.now();
  try {
    const { critique, userContent } = await runCritiqueModel(requestPayload, {
      traceTags: ["lineroom", "critique", "critique-eval-batch"],
      rootObservationName: "lineroom-critique-eval-batch",
      generationName: "lyric-critique-eval-batch",
    });
    const groundTruth = parseGroundTruthSubscores(row.ground_truth_subscores);
    let subscoreCalibration: LineRoomEvalOutputFile["subscoreCalibration"] = null;
    if (groundTruth) {
      const base = evaluateSubscoreCalibration({
        predicted: critique.subscores,
        groundTruth,
        overallBand: parseOverallScoreFromDb(row.overall_score),
      });
      subscoreCalibration = base;
      try {
        const alignment = await judgeSubscoreExplanationAlignment({
          lyrics: requestPayload.fullText,
          predictedSubscores: critique.subscores,
          groundTruthSubscores: groundTruth,
          critiqueExplanation: getCritiqueExplanationText(critique),
        });
        subscoreCalibration = {
          ...base,
          explanationAlignmentScore: alignment.score,
          explanationAlignmentNotes: alignment.notes,
        };
      } catch {
        // Keep batch resilient if secondary judge call fails.
      }
    }
    await uploadOutput(path, {
      ...base,
      evalRow: row,
      requestPayload,
      userPrompt: userContent,
      critique,
      subscoreCalibration,
      elapsedMs: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await uploadOutput(path, {
      ...base,
      evalRow: row,
      requestPayload,
      error: message,
      elapsedMs: Date.now() - started,
    });
  }
}

/**
 * Runs critique for every row in `generate_critique_eval_set` and writes
 * `{runTimestamp}/{id}/output.json` to the eval bucket.
 * Row-level LLM calls run in parallel up to `LINE_ROOM_EVAL_BATCH_CONCURRENCY`.
 */
export async function runEvalBatchForAllRows(runTimestamp: string): Promise<void> {
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    console.error("[runEvalBatch] service role", e);
    return;
  }

  const bucket = getLineRoomEvalsBucket();
  const { data: idRows, error: idErr } = await admin
    .from("generate_critique_eval_set")
    .select("id")
    .order("id", { ascending: true });

  if (idErr) {
    console.error("[runEvalBatch] list ids", idErr.message);
    return;
  }

  const ids = (idRows ?? [])
    .map((r) => (typeof r.id === "number" ? r.id : Number.NaN))
    .filter((n) => Number.isInteger(n) && n > 0);

  const concurrency = getEvalBatchConcurrency();
  await runPool(ids, concurrency, (evalSetId) =>
    processOneEvalRow(admin, runTimestamp, evalSetId),
  );

  const manifestPath = `${runTimestamp}/_manifest.json`;
  const manifest = {
    runTimestamp,
    bucket,
    evalSetIds: ids,
    completedAt: new Date().toISOString(),
    rowCount: ids.length,
    concurrency,
  };
  const { error: manErr } = await admin.storage.from(bucket).upload(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    },
  );
  if (manErr) {
    console.error("[runEvalBatch] manifest", manErr.message);
  }
}
