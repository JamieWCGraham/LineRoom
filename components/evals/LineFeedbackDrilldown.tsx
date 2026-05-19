"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  compareLfDrillRows,
  filterLfDrillRows,
  lfStatusLabel,
  LF_DRILL_FILTERS_EMPTY,
  LF_DRILL_SORT_DEFAULT,
  LF_STATUS_OPTIONS,
  type GroundTruthRow,
  type LfDrillFilterState,
  type LfDrillSortKey,
  type LfDrillSortState,
} from "@/lib/evals/ui";

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

function lfRubricCell(v: number | null | undefined) {
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

export function LineFeedbackDrilldown({ rows, resetKey, onSelectEvalId }: Props) {
  const [lfDrillSort, setLfDrillSort] = useState<LfDrillSortState>(LF_DRILL_SORT_DEFAULT);
  const [lfDrillFilters, setLfDrillFilters] =
    useState<LfDrillFilterState>(LF_DRILL_FILTERS_EMPTY);
  const [lfDrillOpenId, setLfDrillOpenId] = useState<number | null>(null);

  useEffect(() => {
    setLfDrillSort(LF_DRILL_SORT_DEFAULT);
    setLfDrillFilters(LF_DRILL_FILTERS_EMPTY);
    setLfDrillOpenId(null);
  }, [resetKey]);

  const filteredSortedLfDrill = useMemo(() => {
    const filtered = filterLfDrillRows(rows, lfDrillFilters);
    return [...filtered].sort((a, b) =>
      compareLfDrillRows(a, b, lfDrillSort.key, lfDrillSort.dir),
    );
  }, [rows, lfDrillFilters, lfDrillSort]);

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

  if (rows.length === 0) return null;

  return (
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
                    {lfRubricCell(j?.specificity)}
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-center">
                    {lfRubricCell(j?.revision_usefulness)}
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-center">
                    {lfRubricCell(j?.context_awareness)}
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
      {filteredSortedLfDrill.length === 0 ?
        <p className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
          No rows match the current filters.
        </p>
      : null}
    </div>
  </div>
  );
}
