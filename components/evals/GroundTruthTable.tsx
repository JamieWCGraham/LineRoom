"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareGroundTruthRows,
  filterGroundTruthRows,
  GT_FILTERS_EMPTY,
  GT_SORT_DEFAULT,
  type GtFilterState,
  type GtSortKey,
  type GtSortState,
  type GroundTruthRow,
} from "@/lib/evals/ui";

type Props = {
  rows: GroundTruthRow[];
  resetKey?: string;
};

export function GroundTruthTable({ rows, resetKey }: Props) {
  const [gtSort, setGtSort] = useState<GtSortState>(GT_SORT_DEFAULT);
  const [gtFilters, setGtFilters] = useState<GtFilterState>(GT_FILTERS_EMPTY);

  useEffect(() => {
    setGtSort(GT_SORT_DEFAULT);
    setGtFilters(GT_FILTERS_EMPTY);
  }, [resetKey]);

  const filteredSortedGroundTruth = useMemo(() => {
    const filtered = filterGroundTruthRows(rows, gtFilters);
    return [...filtered].sort((a, b) =>
      compareGroundTruthRows(a, b, gtSort.key, gtSort.dir),
    );
  }, [rows, gtFilters, gtSort]);

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

  if (rows.length === 0) return null;

  return (
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
  );
}
