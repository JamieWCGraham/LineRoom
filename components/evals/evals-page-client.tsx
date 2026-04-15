"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";
import type { CritiqueResult } from "@/lib/types";
import { critiqueResultSchema } from "@/lib/validators";

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
  skipped: {
    missingOutput: number[];
    missingPrediction: number[];
    invalidGoldLabel: number[];
  };
};

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
  const [fetchingOutput, setFetchingOutput] = useState(false);
  const [metrics, setMetrics] = useState<EvalRunMetricsResponse | null>(null);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

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
      setEvalId((prev) =>
        prev != null && nextIds.includes(prev) ? prev : (nextIds[0] ?? null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

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
      if (data.runTimestamp) setRunId(data.runTimestamp);
    } finally {
      setBatchBusy(false);
    }
  };

  const lyrics =
    output?.requestPayload?.fullText?.trim() ?
      output.requestPayload.fullText
    : "";

  const title = output?.requestPayload?.title?.trim() || "(untitled)";
  const genre = output?.requestPayload?.genre?.trim() || "";
  const similar = output?.requestPayload?.similarArtists?.trim() || "";

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

  return (
    <div className="mt-8 space-y-6">
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
            onClick={() => void refreshRuns()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Refresh runs
          </button>
        </div>
        {batchMessage ?
          <p className="mt-3 text-sm text-zinc-400">{batchMessage}</p>
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
          <div className="mt-4 overflow-x-auto">
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
