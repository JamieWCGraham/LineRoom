"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { strengthWeaknessJudgeComposite } from "@/lib/evals/strengthWeaknessMetrics";
import {
  compareSwDrillRows,
  filterSwDrillRows,
  swStatusLabel,
  SW_DRILL_FILTERS_EMPTY,
  SW_DRILL_SORT_DEFAULT,
  SW_STATUS_OPTIONS,
  type GroundTruthRow,
  type SwDrillFilterState,
  type SwDrillSortKey,
  type SwDrillSortState,
} from "@/lib/evals/ui";

function swRubricCell(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) {
    return <span className="text-zinc-600">—</span>;
  }
  return <span className="font-mono tabular-nums text-zinc-200">{v}</span>;
}

type Props = {
  rows: GroundTruthRow[];
  resetKey?: string;
  onSelectEvalId: (id: number) => void;
};

export function StrengthWeaknessDrilldown({ rows, resetKey, onSelectEvalId }: Props) {
  const [swDrillSort, setSwDrillSort] = useState<SwDrillSortState>(SW_DRILL_SORT_DEFAULT);
  const [swDrillFilters, setSwDrillFilters] =
    useState<SwDrillFilterState>(SW_DRILL_FILTERS_EMPTY);
  const [swDrillOpenId, setSwDrillOpenId] = useState<number | null>(null);

  useEffect(() => {
    setSwDrillSort(SW_DRILL_SORT_DEFAULT);
    setSwDrillFilters(SW_DRILL_FILTERS_EMPTY);
    setSwDrillOpenId(null);
  }, [resetKey]);

  const filteredSortedSwDrill = useMemo(() => {
    const filtered = filterSwDrillRows(rows, swDrillFilters);
    return [...filtered].sort((a, b) =>
      compareSwDrillRows(a, b, swDrillSort.key, swDrillSort.dir),
    );
  }, [rows, swDrillFilters, swDrillSort]);

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

  if (rows.length === 0) return null;

  return (
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
                          onClick={() => onSelectEvalId(r.id)}
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
  );
}
