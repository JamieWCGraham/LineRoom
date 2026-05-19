"use client";

import Link from "next/link";
import { AddNewSongsModal } from "@/components/evals/add-new-songs-modal";

type Props = {
  email: string;
  addSongsOpen: boolean;
  setAddSongsOpen: (open: boolean) => void;
  batchBusy: boolean;
  batchMessage: string | null;
  batchRunId: string | null;
  batchCompleted: number;
  batchTotalRows: number | null;
  progressRatio: number;
  onStartBatch: () => void;
  onRefreshRuns: () => void;
  runs: string[];
  runId: string;
  onRunIdChange: (runId: string) => void;
  ids: number[];
  evalId: number | null;
  onEvalIdChange: (evalId: number | null) => void;
  idx: number;
  onGoPrev: () => void;
  onGoNext: () => void;
  retryBusy: boolean;
  onRetryCurrentRow: () => void;
  metricsLoading: boolean;
  metricsVisible: boolean;
  onMetricsButtonClick: () => void;
};

export function EvalRunSelector({
  email,
  addSongsOpen,
  setAddSongsOpen,
  batchBusy,
  batchMessage,
  batchRunId,
  batchCompleted,
  batchTotalRows,
  progressRatio,
  onStartBatch,
  onRefreshRuns,
  runs,
  runId,
  onRunIdChange,
  ids,
  evalId,
  onEvalIdChange,
  idx,
  onGoPrev,
  onGoNext,
  retryBusy,
  onRetryCurrentRow,
  metricsLoading,
  metricsVisible,
  onMetricsButtonClick,
}: Props) {
  return (
    <>
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
            onClick={() => void onStartBatch()}
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
            onClick={() => void onRefreshRuns()}
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
            onChange={(e) => onRunIdChange(e.target.value)}
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
              onEvalIdChange(v ? Number.parseInt(v, 10) : null);
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
            onClick={() => void onRetryCurrentRow()}
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
            onClick={onGoPrev}
            disabled={idx <= 0}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onGoNext}
            disabled={idx < 0 || idx >= ids.length - 1}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
