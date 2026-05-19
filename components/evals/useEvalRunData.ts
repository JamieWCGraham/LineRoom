"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseGroundTruthLineFeedback } from "@/lib/evals/lineFeedbackGroundTruth";
import { parseLineFeedbackEvalFromOutputJson } from "@/lib/evals/lineFeedbackMetrics";
import { parseGroundTruthSubscores } from "@/lib/evals/subscoreCalibration";
import { parseGroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessGroundTruth";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";
import type { CritiqueResult } from "@/lib/types";
import { critiqueResultSchema } from "@/lib/validators";

export type EvalOutputJson = {
  runTimestamp?: string;
  evalSetId?: number;
  evalRow?: unknown;
  requestPayload?: {
    fullText?: string;
    title?: string;
    genre?: string;
    similarArtists?: string;
  };
  critique?: unknown;
  error?: string | null;
  elapsedMs?: number;
  userPrompt?: string;
  lineFeedbackEval?: unknown;
};

type BandStratumMetrics = {
  count: number;
  correct: number;
  accuracy: number | null;
};

export type EvalRunMetricsResponse = {
  runId: string;
  totalCompared: number;
  totalCorrect: number;
  totalAccuracy: number | null;
  byOverallScore: Record<string, BandStratumMetrics>;
  confusionMatrix: Record<string, Record<string, number>>;
  groundTruthRows: Array<{
    id: number;
    title: string;
    artist: string;
    overallScore: string;
    isCorrect: boolean;
    predictedOverallScore: string | null;
    strengthWeaknessDrilldown: {
      status: import("@/lib/evals/computeEvalRunMetrics").StrengthWeaknessDrilldownStatus;
      goldStrengths: string[];
      goldWeaknesses: string[];
      predictedStrengths: string[];
      predictedWeaknesses: string[];
      judge: {
        specificity: number;
        evidence_grounding: number;
        non_redundancy: number;
        actionability: number;
        fairness: number;
        failure_flags: string[];
        notes?: string;
      } | null;
    };
    lineFeedbackDrilldown: {
      status: import("@/lib/evals/computeEvalRunMetrics").LineFeedbackDrilldownStatus;
      goldMustLines: string[];
      goldOptionalLines: string[];
      predictedLineFeedback: Array<{
        quotedLine: string;
        feedback: string;
        category: "praise" | "constructive";
        strength?: "strong" | "promising" | "suggestion";
      }>;
      judge: {
        coverage: number;
        label_calibration: number;
        specificity: number;
        revision_usefulness: number;
        context_awareness: number;
        failure_flags: string[];
        notes?: string;
        line_level_composite: number;
      } | null;
    };
  }>;
  subscoreCalibration: {
    comparedRows: number;
    meanAbsoluteError: number | null;
    bandConsistencyPassRate: number | null;
    explanationAlignmentMean: number | null;
    byDimension: Record<
      string,
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

export function useEvalRunData() {
  const [runs, setRuns] = useState<string[]>([]);
  const [runId, setRunId] = useState<string>("");
  const [ids, setIds] = useState<number[]>([]);
  const [evalId, setEvalId] = useState<number | null>(null);
  const [output, setOutput] = useState<EvalOutputJson | null>(null);
  const [critique, setCritique] = useState<CritiqueResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchRunId, setBatchRunId] = useState<string | null>(null);
  const [batchCompleted, setBatchCompleted] = useState<number>(0);
  const [batchTotalRows, setBatchTotalRows] = useState<number | null>(null);
  const [fetchingOutput, setFetchingOutput] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<EvalRunMetricsResponse | null>(null);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [addSongsOpen, setAddSongsOpen] = useState(false);

  const refreshRuns = useCallback(async () => {
    setListError(null);
    const res = await fetch("/api/evals/runs");
    const data = (await res.json().catch(() => ({}))) as {
      runs?: string[];
      error?: string;
    };
    if (!res.ok) {
      setListError(typeof data.error === "string" ? data.error : "Could not list runs.");
      return;
    }
    const next = data.runs ?? [];
    setRuns(next);
    setRunId((prev) => (prev && next.includes(prev) ? prev : (next[0] ?? "")));
  }, []);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    if (!runId) {
      setIds([]);
      setEvalId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setListError(null);
      const res = await fetch(
        `/api/evals/runs/${encodeURIComponent(runId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        ids?: number[];
        totalRows?: number | null;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setListError(
          typeof data.error === "string" ? data.error : "Could not list ids.",
        );
        setIds([]);
        setEvalId(null);
        return;
      }
      const nextIds = data.ids ?? [];
      setIds(nextIds);
      if (runId && batchRunId === runId) {
        setBatchCompleted(nextIds.length);
        setBatchTotalRows(
          typeof data.totalRows === "number" && Number.isFinite(data.totalRows) ?
            data.totalRows
          : null,
        );
      }
      setEvalId((prev) =>
        prev != null && nextIds.includes(prev) ? prev : (nextIds[0] ?? null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [batchRunId, runId]);

  useEffect(() => {
    if (!batchRunId) return;
    const poll = async () => {
      const res = await fetch(`/api/evals/runs/${encodeURIComponent(batchRunId)}`);
      const data = (await res.json().catch(() => ({}))) as {
        ids?: number[];
        totalRows?: number | null;
        error?: string;
      };
      if (!res.ok) return;
      const completed = (data.ids ?? []).length;
      const total =
        typeof data.totalRows === "number" && Number.isFinite(data.totalRows) ?
          data.totalRows
        : null;
      setBatchCompleted(completed);
      setBatchTotalRows(total);
      if (total != null && total > 0 && completed >= total) {
        setBatchMessage(`Run ${batchRunId} complete (${completed}/${total}).`);
        setBatchRunId(null);
        await refreshRuns();
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [batchRunId, refreshRuns]);

  useEffect(() => {
    setMetrics(null);
    setMetricsError(null);
    setMetricsVisible(false);
  }, [runId]);

  useEffect(() => {
    if (!runId || evalId == null) {
      setOutput(null);
      setCritique(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setFetchingOutput(true);
      setLoadError(null);
      setOutput(null);
      setCritique(null);
      const res = await fetch(
        `/api/evals/runs/${encodeURIComponent(runId)}/${evalId}`,
      );
      const data = (await res.json().catch(() => ({}))) as EvalOutputJson & {
        error?: string;
      };
      if (cancelled) return;
      setFetchingOutput(false);
      if (!res.ok) {
        setOutput(null);
        setCritique(null);
        setLoadError(
          typeof data.error === "string" ? data.error : "Could not load result.",
        );
        return;
      }
      setOutput(data);
      const parsed = data.critique
        ? critiqueResultSchema.safeParse(data.critique)
        : null;
      setCritique(parsed?.success ? parsed.data : null);
      if (data.error && !parsed?.success && data.critique) {
        setLoadError("Critique JSON failed validation.");
      } else {
        setLoadError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, evalId]);

  const idx = useMemo(() => {
    if (evalId == null) return -1;
    return ids.indexOf(evalId);
  }, [evalId, ids]);

  const goPrev = () => {
    if (idx <= 0) return;
    setEvalId(ids[idx - 1]!);
  };

  const goNext = () => {
    if (idx < 0 || idx >= ids.length - 1) return;
    setEvalId(ids[idx + 1]!);
  };

  const fetchMetrics = async () => {
    if (!runId) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch(
        `/api/evals/runs/${encodeURIComponent(runId)}/metrics`,
      );
      const data = (await res.json().catch(() => ({}))) as EvalRunMetricsResponse & {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setMetrics(null);
        setMetricsError(
          typeof data.error === "string" ?
            data.detail ?
              `${data.error}: ${data.detail}`
            : data.error
          : "Could not load metrics.",
        );
        return;
      }
      setMetrics(data as EvalRunMetricsResponse);
      setMetricsVisible(true);
    } finally {
      setMetricsLoading(false);
    }
  };

  const onMetricsButtonClick = () => {
    if (metricsVisible) {
      setMetricsVisible(false);
      return;
    }
    if (metrics) {
      setMetricsVisible(true);
      return;
    }
    void fetchMetrics();
  };

  const startBatch = async () => {
    setBatchBusy(true);
    setBatchMessage(null);
    try {
      const res = await fetch("/api/evals/batch", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        runTimestamp?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setBatchMessage(
          typeof data.error === "string" ? data.error : "Batch request failed.",
        );
        return;
      }
      setBatchMessage(
        data.runTimestamp ?
          `Started run ${data.runTimestamp}. Refresh runs shortly to open it.`
        : (data.message ?? "Batch started."),
      );
      await refreshRuns();
      if (data.runTimestamp) {
        setRunId(data.runTimestamp);
        setBatchRunId(data.runTimestamp);
        setBatchCompleted(0);
        setBatchTotalRows(null);
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const retryCurrentRow = async () => {
    if (!runId || evalId == null || retryBusy) return;
    setRetryBusy(true);
    setRetryMessage(null);
    try {
      const res = await fetch(
        `/api/evals/runs/${encodeURIComponent(runId)}/${evalId}`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setRetryMessage(
          typeof data.error === "string" ?
            data.detail ?
              `${data.error}: ${data.detail}`
            : data.error
          : "Retry failed.",
        );
        return;
      }
      setRetryMessage(data.message ?? `Retried row ${evalId}.`);

      await Promise.all([
        (async () => {
          const rowRes = await fetch(
            `/api/evals/runs/${encodeURIComponent(runId)}/${evalId}`,
          );
          const rowData = (await rowRes.json().catch(() => ({}))) as EvalOutputJson & {
            error?: string;
          };
          if (!rowRes.ok) return;
          setOutput(rowData);
          const parsed = rowData.critique ?
              critiqueResultSchema.safeParse(rowData.critique)
            : null;
          setCritique(parsed?.success ? parsed.data : null);
          if (rowData.error && !parsed?.success && rowData.critique) {
            setLoadError("Critique JSON failed validation.");
          } else {
            setLoadError(null);
          }
        })(),
        refreshRuns(),
      ]);
    } finally {
      setRetryBusy(false);
    }
  };

  const lyrics =
    output?.requestPayload?.fullText?.trim() ?
      output.requestPayload.fullText
    : "";

  const title = output?.requestPayload?.title?.trim() || "(untitled)";
  const genre = output?.requestPayload?.genre?.trim() || "";
  const similar = output?.requestPayload?.similarArtists?.trim() || "";
  const progressTotal = batchTotalRows ?? 0;
  const progressRatio =
    progressTotal > 0 ? Math.min(batchCompleted / progressTotal, 1) : 0;

  const lineFeedbackByIndex = useMemo(() => {
    if (!critique?.lineFeedback?.length || !lyrics.trim()) {
      return new Map<number, LineAnnotation[]>();
    }
    return buildLineFeedbackByIndex(lyrics, critique.lineFeedback);
  }, [lyrics, critique]);

  const lineFeedbackAutoShowKey = useMemo(
    () =>
      critique?.lineFeedback?.length ?
        JSON.stringify(critique.lineFeedback)
      : "",
    [critique?.lineFeedback],
  );

  const evalRowObject =
    output?.evalRow && typeof output.evalRow === "object" ?
      (output.evalRow as Record<string, unknown>)
    : null;

  const selectedGroundTruthSubscores = useMemo(
    () => parseGroundTruthSubscores(evalRowObject?.ground_truth_subscores),
    [evalRowObject],
  );

  const selectedGroundTruthApproved =
    typeof evalRowObject?.ground_truth_subscores_approved === "boolean" ?
      evalRowObject.ground_truth_subscores_approved
    : null;

  const selectedGroundTruthStrengthsWeaknesses = useMemo(
    () =>
      parseGroundTruthStrengthsWeaknesses(
        evalRowObject?.ground_truth_strengths_weaknesses,
      ),
    [evalRowObject],
  );

  const selectedGroundTruthStrengthsWeaknessesApproved =
    typeof evalRowObject?.ground_truth_strengths_weaknesses_approved === "boolean" ?
      evalRowObject.ground_truth_strengths_weaknesses_approved
    : null;

  const selectedGroundTruthLineFeedback = useMemo(
    () => parseGroundTruthLineFeedback(evalRowObject?.ground_truth_line_feedback),
    [evalRowObject],
  );

  const selectedGroundTruthLineFeedbackApproved =
    typeof evalRowObject?.ground_truth_line_feedback_approved === "boolean" ?
      evalRowObject.ground_truth_line_feedback_approved
    : null;

  const selectedLineFeedbackEval = useMemo(
    () => parseLineFeedbackEvalFromOutputJson(output),
    [output],
  );

  return {
    runs,
    runId,
    setRunId,
    ids,
    evalId,
    setEvalId,
    output,
    critique,
    listError,
    loadError,
    batchBusy,
    batchMessage,
    batchRunId,
    batchCompleted,
    batchTotalRows,
    progressRatio,
    fetchingOutput,
    retryBusy,
    retryMessage,
    metrics,
    metricsVisible,
    metricsLoading,
    metricsError,
    addSongsOpen,
    setAddSongsOpen,
    refreshRuns,
    startBatch,
    retryCurrentRow,
    onMetricsButtonClick,
    goPrev,
    goNext,
    idx,
    lyrics,
    title,
    genre,
    similar,
    lineFeedbackByIndex,
    lineFeedbackAutoShowKey,
    selectedGroundTruthSubscores,
    selectedGroundTruthApproved,
    selectedGroundTruthStrengthsWeaknesses,
    selectedGroundTruthStrengthsWeaknessesApproved,
    selectedGroundTruthLineFeedback,
    selectedGroundTruthLineFeedbackApproved,
    selectedLineFeedbackEval,
  };
}
