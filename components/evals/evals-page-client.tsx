"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";
import {
  parseGroundTruthSubscores,
  SUBSCORE_DIMENSIONS,
} from "@/lib/evals/subscoreCalibration";
import { parseGroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessGroundTruth";
import { parseGroundTruthLineFeedback } from "@/lib/evals/lineFeedbackGroundTruth";
import { parseLineFeedbackEvalFromOutputJson } from "@/lib/evals/lineFeedbackMetrics";
import type {
  LineFeedbackDrilldownStatus,
  StrengthWeaknessDrilldownStatus,
} from "@/lib/evals/computeEvalRunMetrics";
import { strengthWeaknessJudgeComposite } from "@/lib/evals/strengthWeaknessMetrics";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";
import type { CritiqueResult } from "@/lib/types";
import { critiqueResultSchema } from "@/lib/validators";
import { AddNewSongsModal } from "@/components/evals/add-new-songs-modal";

type EvalOutputJson = {
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

type EvalRunMetricsResponse = {
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
      status: StrengthWeaknessDrilldownStatus;
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
      status: LineFeedbackDrilldownStatus;
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

type GroundTruthRow = EvalRunMetricsResponse["groundTruthRows"][number];

type GtSortKey =
  | "id"
  | "title"
  | "artist"
  | "overallScore"
  | "isCorrect"
  | "predictedOverallScore";

type GtSortState = { key: GtSortKey; dir: "asc" | "desc" };

type GtFilterState = {
  id: string;
  title: string;
  artist: string;
  overallScore: string;
  isCorrect: "all" | "true" | "false";
  predictedOverallScore: string;
};

const GT_SORT_DEFAULT: GtSortState = {
  key: "overallScore",
  dir: "asc",
};

const GT_FILTERS_EMPTY: GtFilterState = {
  id: "",
  title: "",
  artist: "",
  overallScore: "",
  isCorrect: "all",
  predictedOverallScore: "",
};

const BAND_ORDER = new Map(
  CANONICAL_RATING_BANDS.map((band, index) => [band, index] as const),
);

/** Lower = earlier in ascending “quality” order (Needs Work → Standout). */
function bandSortRank(score: string | null | undefined): number {
  if (score == null || !String(score).trim()) {
    return CANONICAL_RATING_BANDS.length + 1;
  }
  const t = String(score).trim();
  const i = BAND_ORDER.get(t as (typeof CANONICAL_RATING_BANDS)[number]);
  if (i !== undefined) return i;
  return CANONICAL_RATING_BANDS.length;
}

function compareGroundTruthRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: GtSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "artist":
      cmp = (a.artist || "").localeCompare(b.artist || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "overallScore": {
      const ra = bandSortRank(a.overallScore);
      const rb = bandSortRank(b.overallScore);
      cmp =
        ra !== rb ? ra - rb : (a.overallScore || "").localeCompare(b.overallScore || "");
      break;
    }
    case "isCorrect":
      cmp = Number(a.isCorrect) - Number(b.isCorrect);
      break;
    case "predictedOverallScore": {
      const ra = bandSortRank(a.predictedOverallScore);
      const rb = bandSortRank(b.predictedOverallScore);
      cmp =
        ra !== rb ?
          ra - rb
        : (a.predictedOverallScore || "").localeCompare(
            b.predictedOverallScore || "",
          );
      break;
    }
    default:
      cmp = 0;
  }
  return sign * cmp;
}

const SW_STATUS_OPTIONS: StrengthWeaknessDrilldownStatus[] = [
  "ok",
  "no_gold_reference",
  "no_judge_in_output",
  "missing_run_output",
  "missing_prediction",
  "invalid_gold_label",
];

function swStatusLabel(s: StrengthWeaknessDrilldownStatus): string {
  switch (s) {
    case "ok":
      return "Judge OK";
    case "no_gold_reference":
      return "No HITL SW";
    case "no_judge_in_output":
      return "No judge block";
    case "missing_run_output":
      return "Missing output";
    case "missing_prediction":
      return "Bad output";
    case "invalid_gold_label":
      return "Invalid gold band";
    default:
      return s;
  }
}

type SwDrillSortKey =
  | "id"
  | "title"
  | "swSpecificity"
  | "swEvidence"
  | "swNonRedundancy"
  | "swActionability"
  | "swFairness"
  | "swComposite"
  | "swFlagCount"
  | "swStatus";

type SwDrillSortState = { key: SwDrillSortKey; dir: "asc" | "desc" };

type SwDrillFilterState = {
  id: string;
  title: string;
  status: "all" | StrengthWeaknessDrilldownStatus;
  issuesOnly: boolean;
};

const SW_DRILL_SORT_DEFAULT: SwDrillSortState = {
  key: "swComposite",
  dir: "asc",
};

const SW_DRILL_FILTERS_EMPTY: SwDrillFilterState = {
  id: "",
  title: "",
  status: "all",
  issuesOnly: false,
};

function filterSwDrillRows(
  rows: GroundTruthRow[],
  f: SwDrillFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  return rows.filter((r) => {
    const sw = r.strengthWeaknessDrilldown;
    if (!sw) return false;
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (f.status !== "all" && sw.status !== f.status) return false;
    if (f.issuesOnly) {
      const composite = strengthWeaknessJudgeComposite(sw.judge);
      const flags = sw.judge?.failure_flags?.length ?? 0;
      const lowComposite = composite != null && composite < 3.5;
      const missingJudgeWithGold =
        sw.status === "no_judge_in_output" &&
        (sw.goldStrengths.length > 0 || sw.goldWeaknesses.length > 0);
      if (!lowComposite && flags === 0 && !missingJudgeWithGold) return false;
    }
    return true;
  });
}

function cmpJudgeDim(
  a: GroundTruthRow["strengthWeaknessDrilldown"]["judge"],
  b: GroundTruthRow["strengthWeaknessDrilldown"]["judge"],
  dim: "specificity" | "evidence_grounding" | "non_redundancy" | "actionability" | "fairness",
): number {
  const va = a?.[dim];
  const vb = b?.[dim];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return va - vb;
}

function compareSwDrillRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: SwDrillSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  const swA = a.strengthWeaknessDrilldown;
  const swB = b.strengthWeaknessDrilldown;
  if (!swA || !swB) return 0;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "swSpecificity":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "specificity");
      break;
    case "swEvidence":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "evidence_grounding");
      break;
    case "swNonRedundancy":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "non_redundancy");
      break;
    case "swActionability":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "actionability");
      break;
    case "swFairness":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "fairness");
      break;
    case "swComposite": {
      const ca = strengthWeaknessJudgeComposite(swA.judge);
      const cb = strengthWeaknessJudgeComposite(swB.judge);
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "swFlagCount": {
      const fa = swA.judge?.failure_flags?.length ?? 0;
      const fb = swB.judge?.failure_flags?.length ?? 0;
      cmp = fa - fb;
      break;
    }
    case "swStatus":
      cmp = swA.status.localeCompare(swB.status);
      break;
    default:
      cmp = 0;
  }
  return sign * cmp;
}

function swRubricCell(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) {
    return <span className="text-zinc-600">—</span>;
  }
  return <span className="font-mono tabular-nums text-zinc-200">{v}</span>;
}

const LF_STATUS_OPTIONS: LineFeedbackDrilldownStatus[] = [
  "ok",
  "no_gold_reference",
  "no_judge_in_output",
  "missing_run_output",
  "missing_prediction",
  "invalid_gold_label",
];

function lfStatusLabel(s: LineFeedbackDrilldownStatus): string {
  switch (s) {
    case "ok":
      return "Judge OK";
    case "no_gold_reference":
      return "No HITL line ref";
    case "no_judge_in_output":
      return "No judge block";
    case "missing_run_output":
      return "Missing output";
    case "missing_prediction":
      return "Bad output";
    case "invalid_gold_label":
      return "Invalid gold band";
    default:
      return s;
  }
}

type LfDrillSortKey = "id" | "title" | "lfComposite" | "lfCoverage" | "lfStatus";

type LfDrillSortState = { key: LfDrillSortKey; dir: "asc" | "desc" };

type LfDrillFilterState = {
  id: string;
  title: string;
  status: "all" | LineFeedbackDrilldownStatus;
  issuesOnly: boolean;
};

const LF_DRILL_SORT_DEFAULT: LfDrillSortState = {
  key: "lfComposite",
  dir: "asc",
};

const LF_DRILL_FILTERS_EMPTY: LfDrillFilterState = {
  id: "",
  title: "",
  status: "all",
  issuesOnly: false,
};

function filterLfDrillRows(
  rows: GroundTruthRow[],
  f: LfDrillFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  return rows.filter((r) => {
    const lf = r.lineFeedbackDrilldown;
    if (!lf) return false;
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (f.status !== "all" && lf.status !== f.status) return false;
    if (f.issuesOnly) {
      const comp = lf.judge?.line_level_composite;
      const flags = lf.judge?.failure_flags?.length ?? 0;
      const lowComposite = comp != null && comp < 0.45;
      const missingJudgeWithGold =
        lf.status === "no_judge_in_output" &&
        (lf.goldMustLines.length > 0 || lf.goldOptionalLines.length > 0);
      if (!lowComposite && flags === 0 && !missingJudgeWithGold) return false;
    }
    return true;
  });
}

function compareLfDrillRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: LfDrillSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  const lfA = a.lineFeedbackDrilldown;
  const lfB = b.lineFeedbackDrilldown;
  if (!lfA || !lfB) return 0;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "lfComposite": {
      const ca = lfA.judge?.line_level_composite;
      const cb = lfB.judge?.line_level_composite;
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "lfCoverage": {
      const ca = lfA.judge?.coverage;
      const cb = lfB.judge?.coverage;
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "lfStatus":
      cmp = lfA.status.localeCompare(lfB.status);
      break;
    default:
      cmp = 0;
  }
  return sign * cmp;
}

function lfFracCell(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) {
    return <span className="text-zinc-600">—</span>;
  }
  return (
    <span className="font-mono tabular-nums text-zinc-200">
      {(Math.round(v * 1000) / 10).toFixed(1)}%
    </span>
  );
}

function filterGroundTruthRows(
  rows: GroundTruthRow[],
  f: GtFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  const artistNeedle = f.artist.trim().toLowerCase();
  const scoreNeedle = f.overallScore.trim().toLowerCase();
  const predNeedle = f.predictedOverallScore.trim().toLowerCase();
  return rows.filter((r) => {
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (artistNeedle && !(r.artist || "").toLowerCase().includes(artistNeedle)) {
      return false;
    }
    if (
      scoreNeedle &&
      !(r.overallScore || "").toLowerCase().includes(scoreNeedle)
    ) {
      return false;
    }
    if (
      predNeedle &&
      !(r.predictedOverallScore || "").toLowerCase().includes(predNeedle)
    ) {
      return false;
    }
    if (f.isCorrect !== "all") {
      const want = f.isCorrect === "true";
      if (r.isCorrect !== want) return false;
    }
    return true;
  });
}

type Props = {
  email: string;
};

export function EvalsPageClient({ email }: Props) {
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
  const [gtSort, setGtSort] = useState<GtSortState>(GT_SORT_DEFAULT);
  const [gtFilters, setGtFilters] = useState<GtFilterState>(GT_FILTERS_EMPTY);
  const [swDrillSort, setSwDrillSort] = useState<SwDrillSortState>(SW_DRILL_SORT_DEFAULT);
  const [swDrillFilters, setSwDrillFilters] =
    useState<SwDrillFilterState>(SW_DRILL_FILTERS_EMPTY);
  const [swDrillOpenId, setSwDrillOpenId] = useState<number | null>(null);
  const [lfDrillSort, setLfDrillSort] = useState<LfDrillSortState>(LF_DRILL_SORT_DEFAULT);
  const [lfDrillFilters, setLfDrillFilters] =
    useState<LfDrillFilterState>(LF_DRILL_FILTERS_EMPTY);
  const [lfDrillOpenId, setLfDrillOpenId] = useState<number | null>(null);

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
    if (!metrics?.runId) return;
    setGtSort(GT_SORT_DEFAULT);
    setGtFilters(GT_FILTERS_EMPTY);
    setSwDrillSort(SW_DRILL_SORT_DEFAULT);
    setSwDrillFilters(SW_DRILL_FILTERS_EMPTY);
    setSwDrillOpenId(null);
    setLfDrillSort(LF_DRILL_SORT_DEFAULT);
    setLfDrillFilters(LF_DRILL_FILTERS_EMPTY);
    setLfDrillOpenId(null);
  }, [metrics?.runId]);

  const filteredSortedGroundTruth = useMemo(() => {
    const rows = metrics?.groundTruthRows ?? [];
    const filtered = filterGroundTruthRows(rows, gtFilters);
    return [...filtered].sort((a, b) =>
      compareGroundTruthRows(a, b, gtSort.key, gtSort.dir),
    );
  }, [metrics?.groundTruthRows, gtFilters, gtSort]);

  const filteredSortedSwDrill = useMemo(() => {
    const rows = metrics?.groundTruthRows ?? [];
    const filtered = filterSwDrillRows(rows, swDrillFilters);
    return [...filtered].sort((a, b) =>
      compareSwDrillRows(a, b, swDrillSort.key, swDrillSort.dir),
    );
  }, [metrics?.groundTruthRows, swDrillFilters, swDrillSort]);

  const filteredSortedLfDrill = useMemo(() => {
    const rows = metrics?.groundTruthRows ?? [];
    const filtered = filterLfDrillRows(rows, lfDrillFilters);
    return [...filtered].sort((a, b) =>
      compareLfDrillRows(a, b, lfDrillSort.key, lfDrillSort.dir),
    );
  }, [metrics?.groundTruthRows, lfDrillFilters, lfDrillSort]);

  const onGroundTruthSortClick = (key: GtSortKey) => {
    setGtSort((prev) =>
      prev.key === key ?
        { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" },
    );
  };

  const groundTruthSortIndicator = (key: GtSortKey) => {
    if (gtSort.key !== key) return "";
    return gtSort.dir === "asc" ? " ↑" : " ↓";
  };

  const onSwDrillSortClick = (key: SwDrillSortKey) => {
    setSwDrillSort((prev) =>
      prev.key === key ?
        { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" },
    );
  };

  const swDrillSortIndicator = (key: SwDrillSortKey) => {
    if (swDrillSort.key !== key) return "";
    return swDrillSort.dir === "asc" ? " ↑" : " ↓";
  };

  const onLfDrillSortClick = (key: LfDrillSortKey) => {
    setLfDrillSort((prev) =>
      prev.key === key ?
        { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" },
    );
  };

  const lfDrillSortIndicator = (key: LfDrillSortKey) => {
    if (lfDrillSort.key !== key) return "";
    return lfDrillSort.dir === "asc" ? " ↑" : " ↓";
  };

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

      // Reload selected output and run id list after retry completes.
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
  const subscoreMetrics =
    metrics?.subscoreCalibration ?? {
      comparedRows: 0,
      meanAbsoluteError: null,
      bandConsistencyPassRate: null,
      explanationAlignmentMean: null,
      byDimension: {},
    };
  const swMetrics =
    metrics?.strengthWeaknessCalibration ?? {
      comparedRows: 0,
      meanSpecificity: null,
      meanEvidenceGrounding: null,
      meanNonRedundancy: null,
      meanActionability: null,
      meanFairness: null,
      meanCompositeRubric: null,
      failureFlagCounts: {},
    };
  const swFlagRows = Object.entries(swMetrics.failureFlagCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const lfMetrics =
    metrics?.lineFeedbackCalibration ?? {
      comparedRows: 0,
      meanCoverage: null,
      meanLabelCalibration: null,
      meanSpecificity: null,
      meanRevisionUsefulness: null,
      meanContextAwareness: null,
      meanLineLevelComposite: null,
      failureFlagCounts: {},
    };
  const lfFlagRows = Object.entries(lfMetrics.failureFlagCounts).sort(
    (a, b) => b[1] - a[1],
  );

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

  return (
    <div className="mt-8 space-y-6">
      <AddNewSongsModal open={addSongsOpen} onClose={() => setAddSongsOpen(false)} />
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Evaluation run
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Signed in as <span className="text-zinc-200">{email}</span>. Batch
          jobs write to Supabase Storage (bucket{" "}
          <code className="text-zinc-300">line-room-evals</code> by default).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void startBatch()}
            disabled={batchBusy}
            className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-500 disabled:opacity-50"
          >
            {batchBusy ? "Starting…" : "Run full eval set"}
          </button>
          <button
            type="button"
            onClick={() => setAddSongsOpen(true)}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-100 hover:border-emerald-600/50 hover:bg-emerald-950/45"
          >
            Add New Songs
          </button>
          <Link
            href="/evals/hitl"
            className="rounded-lg border border-indigo-800/60 bg-indigo-950/30 px-4 py-2 text-sm font-medium text-indigo-100 hover:border-indigo-600/50 hover:bg-indigo-950/45"
          >
            HITL Annotations
          </Link>
          <Link
            href="/evals/commits"
            className="rounded-lg border border-sky-800/60 bg-sky-950/30 px-4 py-2 text-sm font-medium text-sky-100 hover:border-sky-600/50 hover:bg-sky-950/45"
          >
            Github Insight Engine
          </Link>
          <button
            type="button"
            onClick={() => void refreshRuns()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Refresh runs
          </button>
        </div>
        {batchMessage ?
          <p className="mt-3 text-sm text-zinc-400">{batchMessage}</p>
        : null}
        {batchRunId ?
          <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Run progress
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {batchCompleted}
              {" / "}
              {batchTotalRows ?? "?"} rows completed
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>
          </div>
        : null}
      </section>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <label className="flex min-w-[12rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Run (timestamp)
          </span>
          <select
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            {runs.length === 0 ?
              <option value="">No runs yet</option>
            : runs.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
          </select>
        </label>
        <label className="flex min-w-[6rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Eval id
          </span>
          <select
            value={evalId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setEvalId(v ? Number.parseInt(v, 10) : null);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            {ids.length === 0 ?
              <option value="">—</option>
            : ids.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void retryCurrentRow()}
            disabled={!runId || evalId == null || retryBusy}
            className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100 hover:border-amber-600/50 hover:bg-amber-950/45 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {retryBusy ? "Retrying row…" : "Retry this row"}
          </button>
          <button
            type="button"
            onClick={onMetricsButtonClick}
            disabled={!runId || metricsLoading}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-100 hover:border-emerald-600/50 hover:bg-emerald-950/45 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {metricsLoading ?
              "Loading metrics…"
            : metricsVisible ?
              "Hide Metrics"
            : "Show Metrics"}
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={idx <= 0}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={idx < 0 || idx >= ids.length - 1}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>

      {metricsError ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {metricsError}
        </p>
      : null}

      {metrics && metricsVisible ?
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Band accuracy (this run)
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Exact match of model{" "}
            <code className="text-zinc-300">overallRatingBand</code> to table{" "}
            <code className="text-zinc-300">overall_score</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">
                {metrics.totalAccuracy != null ?
                  `${Math.round(metrics.totalAccuracy * 1000) / 10}%`
                : "—"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {metrics.totalCorrect} / {metrics.totalCompared} compared
              </p>
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Gold overall_score
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Count and exact-match accuracy by gold band for this run.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Gold overall_score</th>
                  <th className="py-2 pr-4 font-medium">Count</th>
                  <th className="py-2 pr-4 font-medium">Correct</th>
                  <th className="py-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_RATING_BANDS.map((band) => {
                  const row = metrics.byOverallScore[band];
                  if (!row) return null;
                  return (
                    <tr
                      key={band}
                      className="border-b border-zinc-800/80 text-zinc-300"
                    >
                      <td className="py-2 pr-4">{band}</td>
                      <td className="py-2 pr-4">{row.count}</td>
                      <td className="py-2 pr-4">{row.correct}</td>
                      <td className="py-2">
                        {row.accuracy != null ?
                          `${Math.round(row.accuracy * 1000) / 10}%`
                        : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
          {(() => {
            const s = metrics.skipped;
            const parts: string[] = [];
            if (s.missingOutput.length > 0) {
              parts.push(`${s.missingOutput.length} missing output`);
            }
            if (s.missingPrediction.length > 0) {
              parts.push(`${s.missingPrediction.length} missing/invalid prediction`);
            }
            if (s.invalidGoldLabel.length > 0) {
              parts.push(`${s.invalidGoldLabel.length} invalid gold label`);
            }
            if (parts.length === 0) return null;
            return (
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                Skipped: {parts.join("; ")}.
              </p>
            );
          })()}

          {metrics.confusionMatrix ?
            <div className="mt-8">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Confusion matrix
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Rows = ground truth (
                <code className="text-zinc-400">overall_score</code> in Supabase).
                Columns = model prediction (
                <code className="text-zinc-400">overallRatingBand</code>).
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="border-collapse text-center text-xs">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="border border-zinc-700 bg-zinc-950/80 px-2 py-2 text-left font-medium text-zinc-500"
                      >
                        GT / Pred
                      </th>
                      {CANONICAL_RATING_BANDS.map((pred) => (
                        <th
                          key={pred}
                          scope="col"
                          className="max-w-[5.5rem] border border-zinc-700 bg-zinc-950/80 px-1.5 py-2 align-bottom text-[10px] font-medium leading-tight text-zinc-400"
                          title={pred}
                        >
                          {pred}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CANONICAL_RATING_BANDS.map((gold) => (
                      <tr key={gold}>
                        <th
                          scope="row"
                          className="max-w-[6rem] border border-zinc-700 bg-zinc-950/50 px-2 py-2 text-left text-[10px] font-medium leading-tight text-zinc-400"
                          title={gold}
                        >
                          {gold}
                        </th>
                        {CANONICAL_RATING_BANDS.map((pred) => {
                          const cell =
                            metrics.confusionMatrix[gold]?.[pred] ?? 0;
                          const diag = gold === pred;
                          return (
                            <td
                              key={pred}
                              className={`min-w-[2.5rem] border border-zinc-700 px-2 py-2 font-mono tabular-nums text-sm ${
                                diag ?
                                  "bg-emerald-950/35 text-emerald-100"
                                : "text-zinc-200"
                              }`}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          : null}

          {metrics.groundTruthRows && metrics.groundTruthRows.length > 0 ?
            <div className="mt-8">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Ground truth records
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                All rows from <code className="text-zinc-400">generate_critique_eval_set</code>{" "}
                for this comparison. Sorted by{" "}
                <code className="text-zinc-400">overall_score</code> band (Needs Work →
                Standout) until you change the sort. Use column headers to sort; filters
                match as substrings (case-insensitive).
              </p>
              <div className="mt-3 max-h-[min(50vh,28rem)] overflow-auto rounded-lg border border-zinc-800">
                <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                    <tr className="border-b border-zinc-700 text-[10px] uppercase tracking-wide text-zinc-500">
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "id" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("id")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          ID{groundTruthSortIndicator("id")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "title" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("title")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Title{groundTruthSortIndicator("title")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "artist" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("artist")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Artist{groundTruthSortIndicator("artist")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "overallScore" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("overallScore")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          overall_score{groundTruthSortIndicator("overallScore")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "isCorrect" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("isCorrect")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          IS_CORRECT{groundTruthSortIndicator("isCorrect")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" aria-sort={gtSort.key === "predictedOverallScore" ? (gtSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => onGroundTruthSortClick("predictedOverallScore")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          PREDICTED_OVERALL_SCORE
                          {groundTruthSortIndicator("predictedOverallScore")}
                        </button>
                      </th>
                    </tr>
                    <tr className="border-b border-zinc-800 bg-zinc-950/90 text-[10px] normal-case text-zinc-400">
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={gtFilters.id}
                          onChange={(e) =>
                            setGtFilters((p) => ({ ...p, id: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 font-mono text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter by id"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={gtFilters.title}
                          onChange={(e) =>
                            setGtFilters((p) => ({ ...p, title: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter by title"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={gtFilters.artist}
                          onChange={(e) =>
                            setGtFilters((p) => ({ ...p, artist: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter by artist"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={gtFilters.overallScore}
                          onChange={(e) =>
                            setGtFilters((p) => ({
                              ...p,
                              overallScore: e.target.value,
                            }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter by overall score"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <select
                          value={gtFilters.isCorrect}
                          onChange={(e) =>
                            setGtFilters((p) => ({
                              ...p,
                              isCorrect: e.target.value as GtFilterState["isCorrect"],
                            }))
                          }
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-0.5 py-1 text-[10px] text-zinc-200"
                          aria-label="Filter by is correct"
                        >
                          <option value="all">All</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={gtFilters.predictedOverallScore}
                          onChange={(e) =>
                            setGtFilters((p) => ({
                              ...p,
                              predictedOverallScore: e.target.value,
                            }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter by predicted score"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedGroundTruth.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-800/80 text-zinc-300"
                      >
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-400">
                          {r.id}
                        </td>
                        <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.title}>
                          {r.title || "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-1.5" title={r.artist}>
                          {r.artist || "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-1.5">
                          {r.overallScore || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                          {r.isCorrect ?
                            <span className="text-emerald-400">true</span>
                          : <span className="text-zinc-500">false</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.predictedOverallScore ?? (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSortedGroundTruth.length === 0 ?
                  <p className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                    No rows match the current filters.
                  </p>
                : null}
              </div>
            </div>
          : null}

          <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Subscore calibration
            </p>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              <p className="text-zinc-300">
                MAE:{" "}
                <span className="font-semibold text-zinc-100">
                  {subscoreMetrics.meanAbsoluteError != null ?
                    (Math.round(subscoreMetrics.meanAbsoluteError * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Band pass rate:{" "}
                <span className="font-semibold text-zinc-100">
                  {subscoreMetrics.bandConsistencyPassRate != null ?
                    `${Math.round(subscoreMetrics.bandConsistencyPassRate * 1000) / 10}%`
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Explanation alignment mean:{" "}
                <span className="font-semibold text-zinc-100">
                  {subscoreMetrics.explanationAlignmentMean != null ?
                    (Math.round(subscoreMetrics.explanationAlignmentMean * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-500">
                n = {subscoreMetrics.comparedRows}
              </p>
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Subscore
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-700 uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Subscore</th>
                  <th className="py-2 pr-4 font-medium">MAE</th>
                  <th className="py-2 pr-4 font-medium">Within ±1</th>
                  <th className="py-2 font-medium">Failure (2+ off)</th>
                </tr>
              </thead>
              <tbody>
                {SUBSCORE_DIMENSIONS.map((dim) => {
                  const row = subscoreMetrics.byDimension?.[dim];
                  return (
                    <tr key={dim} className="border-b border-zinc-800/80 text-zinc-300">
                      <td className="py-2 pr-4 font-mono text-[11px]">{dim}</td>
                      <td className="py-2 pr-4">
                        {row?.meanAbsoluteError != null ?
                          (Math.round(row.meanAbsoluteError * 100) / 100).toFixed(2)
                        : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {row?.withinToleranceRate != null ?
                          `${Math.round(row.withinToleranceRate * 1000) / 10}%`
                        : "—"}
                      </td>
                      <td className="py-2">
                        {row?.failureRate != null ?
                          `${Math.round(row.failureRate * 1000) / 10}%`
                        : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Top strengths / weaknesses (LLM judge vs HITL reference)
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Means over rows where ground-truth bullets exist and this run stored{" "}
              <code className="text-zinc-400">strengthWeaknessEval</code> in{" "}
              <code className="text-zinc-400">output.json</code>.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <p className="text-zinc-300">
                Composite rubric mean:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanCompositeRubric != null ?
                    (Math.round(swMetrics.meanCompositeRubric * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Specificity:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanSpecificity != null ?
                    (Math.round(swMetrics.meanSpecificity * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Evidence:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanEvidenceGrounding != null ?
                    (Math.round(swMetrics.meanEvidenceGrounding * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Non-redundancy:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanNonRedundancy != null ?
                    (Math.round(swMetrics.meanNonRedundancy * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Actionability:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanActionability != null ?
                    (Math.round(swMetrics.meanActionability * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Fairness:{" "}
                <span className="font-semibold text-zinc-100">
                  {swMetrics.meanFairness != null ?
                    (Math.round(swMetrics.meanFairness * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-500">
                n = {swMetrics.comparedRows}
              </p>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Failure flags (row counts)
            </h3>
            {swFlagRows.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {swFlagRows.map(([flag, count]) => (
                  <li key={flag}>
                    <span className="font-mono text-zinc-300">{flag}</span>: {count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">None in this run.</p>
            )}
          </div>
          {metrics.groundTruthRows && metrics.groundTruthRows.length > 0 ?
            <div className="mt-10 rounded-lg border border-teal-900/35 bg-teal-950/15 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-teal-500/95">
                Top strengths / weaknesses (per song)
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Gold bullets from{" "}
                <code className="text-zinc-400">ground_truth_strengths_weaknesses</code>; model
                lists from this run&apos;s <code className="text-zinc-400">output.json</code>. Expand
                a row to compare side by side and read judge scores when present (same module as the
                aggregate above). Rubric columns are 1–5 from the LLM judge when{" "}
                <code className="text-zinc-400">strengthWeaknessEval</code> is present.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={swDrillFilters.issuesOnly}
                  onChange={(e) =>
                    setSwDrillFilters((p) => ({ ...p, issuesOnly: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Issues only (low judge mean, any failure flag, or gold SW without judge block)
              </label>
              <div className="mt-3 max-h-[min(55vh,32rem)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/40">
                <table className="w-full min-w-[64rem] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                    <tr className="border-b border-zinc-700 text-[10px] uppercase tracking-wide text-zinc-500">
                      <th className="w-8 px-1 py-1 font-medium" aria-hidden />
                      <th className="px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("id")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          ID{swDrillSortIndicator("id")}
                        </button>
                      </th>
                      <th className="min-w-[7rem] px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("title")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Title{swDrillSortIndicator("title")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="specificity">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swSpecificity")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Spec{swDrillSortIndicator("swSpecificity")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="evidence_grounding">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swEvidence")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Evid{swDrillSortIndicator("swEvidence")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="non_redundancy">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swNonRedundancy")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          NonR{swDrillSortIndicator("swNonRedundancy")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="actionability">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swActionability")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Act{swDrillSortIndicator("swActionability")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="fairness">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swFairness")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Fair{swDrillSortIndicator("swFairness")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium" title="Mean of five rubric scores">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swComposite")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          μ{swDrillSortIndicator("swComposite")}
                        </button>
                      </th>
                      <th className="min-w-[11rem] px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swFlagCount")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Failure flags{swDrillSortIndicator("swFlagCount")}
                        </button>
                      </th>
                      <th className="min-w-[6rem] px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onSwDrillSortClick("swStatus")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Status{swDrillSortIndicator("swStatus")}
                        </button>
                      </th>
                    </tr>
                    <tr className="border-b border-zinc-800 bg-zinc-950/90 text-[10px] normal-case text-zinc-400">
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={swDrillFilters.id}
                          onChange={(e) =>
                            setSwDrillFilters((p) => ({ ...p, id: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 font-mono text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter SW drill by id"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={swDrillFilters.title}
                          onChange={(e) =>
                            setSwDrillFilters((p) => ({ ...p, title: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter SW drill by title"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal" colSpan={6}>
                        <select
                          value={swDrillFilters.status}
                          onChange={(e) =>
                            setSwDrillFilters((p) => ({
                              ...p,
                              status: e.target.value as SwDrillFilterState["status"],
                            }))
                          }
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-0.5 py-1 text-[10px] text-zinc-200"
                          aria-label="Filter by SW drill status"
                        >
                          <option value="all">All statuses</option>
                          {SW_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {swStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </th>
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedSwDrill.map((r) => {
                      const sw = r.strengthWeaknessDrilldown;
                      if (!sw) return null;
                      const open = swDrillOpenId === r.id;
                      const comp = strengthWeaknessJudgeComposite(sw.judge);
                      const flagCount = sw.judge?.failure_flags?.length ?? 0;
                      const flagText =
                        sw.judge?.failure_flags?.filter((x) => x.trim()).join(", ") ?? "";
                      return (
                        <Fragment key={r.id}>
                          <tr
                            className="border-b border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50"
                          >
                            <td className="px-1 py-1">
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={open ? "Collapse row" : "Expand row"}
                                onClick={() =>
                                  setSwDrillOpenId((prev) => (prev === r.id ? null : r.id))
                                }
                                className="rounded px-1 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                              >
                                {open ? "−" : "+"}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-400">
                              {r.id}
                            </td>
                            <td className="max-w-[12rem] truncate px-2 py-1.5" title={r.title}>
                              {r.title || "—"}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(sw.judge?.specificity)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(sw.judge?.evidence_grounding)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(sw.judge?.non_redundancy)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(sw.judge?.actionability)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(sw.judge?.fairness)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center font-mono">
                              {comp != null ?
                                (Math.round(comp * 100) / 100).toFixed(2)
                              : <span className="text-zinc-600">—</span>}
                            </td>
                            <td className="max-w-[14rem] px-2 py-1.5 align-top">
                              {!sw.judge ?
                                <span className="text-zinc-600">—</span>
                              : flagCount === 0 ?
                                <span className="text-zinc-500">—</span>
                              : (
                                <p
                                  className="font-mono text-[10px] leading-snug text-amber-200/95 line-clamp-3 break-words"
                                  title={flagText}
                                >
                                  {flagText}
                                </p>
                              )}
                            </td>
                            <td className="max-w-[10rem] truncate px-2 py-1.5 text-[11px] text-zinc-400">
                              {swStatusLabel(sw.status)}
                            </td>
                          </tr>
                          {open ?
                            <tr
                              key={`${r.id}-detail`}
                              className="border-b border-zinc-800/80 bg-zinc-950/80"
                            >
                              <td colSpan={11} className="px-3 py-3 text-[11px] text-zinc-300">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-teal-600/90">
                                      Gold strengths
                                    </p>
                                    {sw.goldStrengths.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {sw.goldStrengths.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                    <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-teal-600/90">
                                      Gold weaknesses
                                    </p>
                                    {sw.goldWeaknesses.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {sw.goldWeaknesses.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                      Model strengths (this run)
                                    </p>
                                    {sw.predictedStrengths.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {sw.predictedStrengths.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                    <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                      Model weaknesses (this run)
                                    </p>
                                    {sw.predictedWeaknesses.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {sw.predictedWeaknesses.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                                {sw.judge ?
                                  <div className="mt-4 rounded border border-zinc-800/80 bg-zinc-900/40 p-3">
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                      Judge rubric (1–5)
                                    </p>
                                    <p className="mt-2 font-mono text-[11px] text-zinc-300">
                                      specificity {sw.judge.specificity} · evidence{" "}
                                      {sw.judge.evidence_grounding} · non_redundancy{" "}
                                      {sw.judge.non_redundancy} · actionability{" "}
                                      {sw.judge.actionability} · fairness {sw.judge.fairness}
                                    </p>
                                    {sw.judge.failure_flags.length > 0 ?
                                      <p className="mt-2 text-[11px] text-amber-200/90">
                                        Flags: {sw.judge.failure_flags.join(", ")}
                                      </p>
                                    : null}
                                    {sw.judge.notes?.trim() ?
                                      <p className="mt-2 text-zinc-400">{sw.judge.notes}</p>
                                    : null}
                                  </div>
                                : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEvalId(r.id)}
                                    className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
                                  >
                                    Open eval id {r.id} in viewer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {filteredSortedSwDrill.length === 0 ?
                  <p className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                    No rows match the current filters.
                  </p>
                : null}
              </div>
            </div>
          : null}

          <div className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Line-level feedback quality (LLM judge vs HITL reference)
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Means over rows where <code className="text-zinc-400">ground_truth_line_feedback</code>{" "}
              has must-hit lines and this run stored{" "}
              <code className="text-zinc-400">lineFeedbackEval</code> in{" "}
              <code className="text-zinc-400">output.json</code>. Composite uses architecture weights
              (coverage 25%, label calibration 20%, specificity / revision / context for the rest).
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <p className="text-zinc-300">
                Composite mean:{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanLineLevelComposite != null ?
                    (Math.round(lfMetrics.meanLineLevelComposite * 1000) / 1000).toFixed(3)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Coverage:{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanCoverage != null ?
                    (Math.round(lfMetrics.meanCoverage * 1000) / 10).toFixed(1) + "%"
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Label cal.:{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanLabelCalibration != null ?
                    (Math.round(lfMetrics.meanLabelCalibration * 1000) / 10).toFixed(1) + "%"
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Specificity (1–5):{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanSpecificity != null ?
                    (Math.round(lfMetrics.meanSpecificity * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Revision:{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanRevisionUsefulness != null ?
                    (Math.round(lfMetrics.meanRevisionUsefulness * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-300">
                Context:{" "}
                <span className="font-semibold text-zinc-100">
                  {lfMetrics.meanContextAwareness != null ?
                    (Math.round(lfMetrics.meanContextAwareness * 100) / 100).toFixed(2)
                  : "—"}
                </span>
              </p>
              <p className="text-zinc-500">n = {lfMetrics.comparedRows}</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Line feedback failure flags (row counts)
            </h3>
            {lfFlagRows.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {lfFlagRows.map(([flag, count]) => (
                  <li key={flag}>
                    <span className="font-mono text-zinc-300">{flag}</span>: {count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">None in this run.</p>
            )}
          </div>

          {metrics.groundTruthRows && metrics.groundTruthRows.length > 0 ?
            <div className="mt-10 rounded-lg border border-cyan-900/35 bg-cyan-950/15 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-cyan-500/95">
                Line-level feedback (per song)
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Gold must-hit lines from{" "}
                <code className="text-zinc-400">ground_truth_line_feedback</code>; model line notes
                from this run&apos;s critique in <code className="text-zinc-400">output.json</code>.
                Expand a row for lists, judge scores, and notes.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={lfDrillFilters.issuesOnly}
                  onChange={(e) =>
                    setLfDrillFilters((p) => ({ ...p, issuesOnly: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Issues only (low composite, any failure flag, or gold reference without judge)
              </label>
              <div className="mt-3 max-h-[min(55vh,32rem)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/40">
                <table className="w-full min-w-[48rem] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                    <tr className="border-b border-zinc-700 text-[10px] uppercase tracking-wide text-zinc-500">
                      <th className="w-8 px-1 py-1 font-medium" aria-hidden />
                      <th className="px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onLfDrillSortClick("id")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          ID{lfDrillSortIndicator("id")}
                        </button>
                      </th>
                      <th className="min-w-[8rem] px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onLfDrillSortClick("title")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Title{lfDrillSortIndicator("title")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onLfDrillSortClick("lfCoverage")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Cov{lfDrillSortIndicator("lfCoverage")}
                        </button>
                      </th>
                      <th className="px-1 py-1 font-medium">Lab</th>
                      <th className="px-1 py-1 font-medium">Spec</th>
                      <th className="px-1 py-1 font-medium">Rev</th>
                      <th className="px-1 py-1 font-medium">Ctx</th>
                      <th className="px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onLfDrillSortClick("lfComposite")}
                          className="w-full rounded px-0.5 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Comp{lfDrillSortIndicator("lfComposite")}
                        </button>
                      </th>
                      <th className="min-w-[10rem] px-1 py-1 font-medium">Flags</th>
                      <th className="min-w-[6rem] px-1 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => onLfDrillSortClick("lfStatus")}
                          className="w-full rounded px-1 py-1.5 text-left hover:bg-zinc-800/80"
                        >
                          Status{lfDrillSortIndicator("lfStatus")}
                        </button>
                      </th>
                    </tr>
                    <tr className="border-b border-zinc-800 bg-zinc-950/90 text-[10px] normal-case text-zinc-400">
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={lfDrillFilters.id}
                          onChange={(e) =>
                            setLfDrillFilters((p) => ({ ...p, id: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 font-mono text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter LF drill by id"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal">
                        <input
                          value={lfDrillFilters.title}
                          onChange={(e) =>
                            setLfDrillFilters((p) => ({ ...p, title: e.target.value }))
                          }
                          placeholder="Filter…"
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
                          aria-label="Filter LF drill by title"
                        />
                      </th>
                      <th className="px-1 py-1 align-top font-normal" colSpan={6}>
                        <select
                          value={lfDrillFilters.status}
                          onChange={(e) =>
                            setLfDrillFilters((p) => ({
                              ...p,
                              status: e.target.value as LfDrillFilterState["status"],
                            }))
                          }
                          className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-0.5 py-1 text-[10px] text-zinc-200"
                          aria-label="Filter by LF drill status"
                        >
                          <option value="all">All statuses</option>
                          {LF_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {lfStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </th>
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedLfDrill.map((r) => {
                      const lf = r.lineFeedbackDrilldown;
                      if (!lf) return null;
                      const open = lfDrillOpenId === r.id;
                      const j = lf.judge;
                      const flagText = j?.failure_flags?.filter((x) => x.trim()).join(", ") ?? "";
                      return (
                        <Fragment key={r.id}>
                          <tr className="border-b border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50">
                            <td className="px-1 py-1">
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={open ? "Collapse row" : "Expand row"}
                                onClick={() =>
                                  setLfDrillOpenId((prev) => (prev === r.id ? null : r.id))
                                }
                                className="rounded px-1 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                              >
                                {open ? "−" : "+"}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-400">
                              {r.id}
                            </td>
                            <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.title}>
                              {r.title || "—"}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {lfFracCell(j?.coverage)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {lfFracCell(j?.label_calibration)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(j?.specificity)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(j?.revision_usefulness)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center">
                              {swRubricCell(j?.context_awareness)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5 text-center font-mono">
                              {j?.line_level_composite != null ?
                                (Math.round(j.line_level_composite * 1000) / 1000).toFixed(3)
                              : <span className="text-zinc-600">—</span>}
                            </td>
                            <td className="max-w-[12rem] px-2 py-1.5 align-top">
                              {!j || flagText.length === 0 ?
                                <span className="text-zinc-600">—</span>
                              : (
                                <p
                                  className="font-mono text-[10px] leading-snug text-amber-200/95 line-clamp-3 break-words"
                                  title={flagText}
                                >
                                  {flagText}
                                </p>
                              )}
                            </td>
                            <td className="max-w-[8rem] truncate px-2 py-1.5 text-[11px] text-zinc-400">
                              {lfStatusLabel(lf.status)}
                            </td>
                          </tr>
                          {open ?
                            <tr
                              key={`${r.id}-lf-detail`}
                              className="border-b border-zinc-800/80 bg-zinc-950/80"
                            >
                              <td colSpan={11} className="px-3 py-3 text-[11px] text-zinc-300">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-600/90">
                                      Gold must-comment lines
                                    </p>
                                    {lf.goldMustLines.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {lf.goldMustLines.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                    <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-cyan-600/90">
                                      Gold optional lines
                                    </p>
                                    {lf.goldOptionalLines.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {lf.goldOptionalLines.map((t, i) => (
                                          <li key={i}>{t}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                      Model line feedback (this run)
                                    </p>
                                    {lf.predictedLineFeedback.length === 0 ?
                                      <p className="mt-1 text-zinc-600">—</p>
                                    : (
                                      <ul className="mt-1 space-y-2">
                                        {lf.predictedLineFeedback.map((item, i) => (
                                          <li key={i} className="list-none">
                                            <p className="font-mono text-[11px] text-zinc-200">
                                              {item.quotedLine}
                                            </p>
                                            <p className="text-[10px] text-zinc-500">
                                              {item.category}
                                              {item.strength ? ` · ${item.strength}` : ""}
                                            </p>
                                            <p className="mt-0.5 text-zinc-400">{item.feedback}</p>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                                {j ?
                                  <div className="mt-4 rounded border border-zinc-800/80 bg-zinc-900/40 p-3">
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                      Judge (coverage / label cal. are 0–1; rubric 1–5)
                                    </p>
                                    <p className="mt-2 font-mono text-[11px] text-zinc-300">
                                      composite {j.line_level_composite.toFixed(3)} · coverage{" "}
                                      {j.coverage.toFixed(2)} · label_cal {j.label_calibration.toFixed(2)}{" "}
                                      · spec {j.specificity} · rev {j.revision_usefulness} · ctx{" "}
                                      {j.context_awareness}
                                    </p>
                                    {j.failure_flags.length > 0 ?
                                      <p className="mt-2 text-[11px] text-amber-200/90">
                                        Flags: {j.failure_flags.join(", ")}
                                      </p>
                                    : null}
                                    {j.notes?.trim() ?
                                      <p className="mt-2 text-zinc-400">{j.notes}</p>
                                    : null}
                                  </div>
                                : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEvalId(r.id)}
                                    className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
                                  >
                                    Open eval id {r.id} in viewer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {filteredSortedLfDrill.length === 0 ?
                  <p className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                    No rows match the current filters.
                  </p>
                : null}
              </div>
            </div>
          : null}
        </section>
      : null}

      {listError ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {listError}
        </p>
      : null}

      {loadError && !output?.error ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {loadError}
        </p>
      : null}

      {retryMessage ?
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {retryMessage}
        </p>
      : null}

      {output?.error ?
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Model/storage error for this row: {output.error}
        </p>
      : null}

      <div className="grid min-h-[min(70dvh,40rem)] gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="flex min-h-[min(50dvh,28rem)] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 px-1 pb-1 pt-2 lg:min-h-0 lg:flex-1 lg:p-2">
          <DraftEditor
            value={fetchingOutput ? "" : lyrics}
            onChange={() => {}}
            readOnly
            lineFeedbackByIndex={lineFeedbackByIndex}
            lineFeedbackAutoShowKey={lineFeedbackAutoShowKey}
            addToChatEnabled={false}
            showFeedbackToggle
            placeholder={
              fetchingOutput ? "Loading…" : "No draft in this result."
            }
            copyButtonIdleLabel="Copy draft"
            textInputAriaLabel="Eval result draft"
            headerLeading={
              <div className="min-w-0 pr-2">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Draft
                </div>
                <p className="mt-1 truncate text-sm text-zinc-300">{title}</p>
                {(genre || similar) ?
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                    {[genre && `Genre: ${genre}`, similar && `Reference: ${similar}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                : null}
                {output?.elapsedMs != null ?
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Generated in {output.elapsedMs} ms
                  </p>
                : null}
              </div>
            }
          />
        </div>

        <div className="flex min-h-[min(50dvh,24rem)] min-h-0 flex-col lg:min-h-0">
          <CritiqueDisplayPanel
            critique={critique}
            loading={fetchingOutput}
            onRegenerate={() => {}}
            lyricsEmpty={!lyrics.trim()}
            groundTruthSubscores={selectedGroundTruthSubscores}
            groundTruthApproved={selectedGroundTruthApproved}
            groundTruthStrengthsWeaknesses={selectedGroundTruthStrengthsWeaknesses}
            groundTruthStrengthsWeaknessesApproved={
              selectedGroundTruthStrengthsWeaknessesApproved
            }
            groundTruthLineFeedback={selectedGroundTruthLineFeedback}
            groundTruthLineFeedbackApproved={selectedGroundTruthLineFeedbackApproved}
            lineFeedbackEval={selectedLineFeedbackEval}
            readOnly
          />
        </div>
      </div>

      <p className="text-center text-xs text-zinc-600">
        <Link href="/" className="text-zinc-400 underline hover:text-zinc-200">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
