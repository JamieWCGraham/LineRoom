"use client";

import { useEffect, useState } from "react";
import { SUBSCORE_DIMENSIONS } from "@/lib/evals/subscoreCalibration";

type HitlRow = {
  id: number;
  title: string | null;
  artist: string | null;
  lyrics: string | null;
  overall_score: string | null;
  ground_truth_subscores: Record<string, number> | null;
  ground_truth_subscores_approved: boolean | null;
};

const defaultScores: Record<string, number> = Object.fromEntries(
  SUBSCORE_DIMENSIONS.map((d) => [d, 3]),
);

export function EvalsHitlClient() {
  const [rows, setRows] = useState<HitlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/evals/hitl?limit=80&offset=0");
      const data = (await res.json().catch(() => ({}))) as { rows?: HitlRow[]; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Failed to load HITL rows.");
        return;
      }
      const nextRows = data.rows ?? [];
      setRows(nextRows);
      setSelectedSongId((prev) => {
        if (nextRows.length === 0) return null;
        if (prev != null && nextRows.some((r) => r.id === prev)) return prev;
        return nextRows[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const saveRow = async (row: HitlRow, approved: boolean) => {
    const groundTruthSubscores = row.ground_truth_subscores ?? defaultScores;
    const res = await fetch(`/api/evals/hitl/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groundTruthSubscores, approved }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? `Failed to save row ${row.id}.`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ?
          {
            ...r,
            ground_truth_subscores: groundTruthSubscores,
            ground_truth_subscores_approved: approved,
          }
        : r,
      ),
    );
    setMessage(`Saved row ${row.id}.`);
  };

  const updateScore = (rowId: number, key: string, nextVal: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const base = r.ground_truth_subscores ?? defaultScores;
        return {
          ...r,
          ground_truth_subscores: { ...base, [key]: nextVal },
          ground_truth_subscores_approved: false,
        };
      }),
    );
  };

  const generateBaseline = async () => {
    setLoading(true);
    setMessage("Generating baseline annotations...");
    try {
      const res = await fetch("/api/evals/hitl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyMissing: true, limit: 40 }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: Array<{ status: string }>;
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Baseline generation failed.");
        return;
      }
      const updated =
        data.results?.filter((r) => r.status === "updated").length ?? 0;
      setMessage(`Baseline generation complete. Updated ${updated} rows.`);
      await loadRows();
    } finally {
      setLoading(false);
    }
  };

  const selectedIndex = rows.findIndex((r) => r.id === selectedSongId);
  const currentRow =
    selectedIndex >= 0 ? rows[selectedIndex]
    : rows.length > 0 ? rows[0]
    : null;

  const goToPreviousSong = () => {
    if (selectedIndex <= 0) return;
    const prev = rows[selectedIndex - 1];
    if (prev) setSelectedSongId(prev.id);
  };

  const goToNextSong = () => {
    if (selectedIndex < 0 || selectedIndex >= rows.length - 1) return;
    const next = rows[selectedIndex + 1];
    if (next) setSelectedSongId(next.id);
  };

  return (
    <section className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">HITL Subscore Annotations</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Create/approve ground-truth subscores for subscore calibration.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void generateBaseline()}
            disabled={loading}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-100 disabled:opacity-40"
          >
            Generate Baseline (missing)
          </button>
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </div>
      {message ? <p className="mt-3 text-xs text-zinc-400">{message}</p> : null}

      {currentRow ?
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
            <label className="flex min-w-[20rem] flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Song
              </span>
              <select
                value={currentRow.id}
                onChange={(e) => setSelectedSongId(Number.parseInt(e.target.value, 10))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {rows.map((row, i) => (
                  <option key={row.id} value={row.id}>
                    {i + 1}. {row.title || "(untitled)"} - {row.artist || "Unknown artist"}{" "}
                    {row.ground_truth_subscores_approved ? "✓" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goToPreviousSong}
                disabled={selectedIndex <= 0}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
              >
                Previous song
              </button>
              <button
                type="button"
                onClick={goToNextSong}
                disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
              >
                Next song
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {selectedIndex + 1} / {rows.length}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {currentRow.title || "(untitled)"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {currentRow.artist || "Unknown artist"} · GT overall:{" "}
                    {currentRow.overall_score || "—"}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">ID {currentRow.id}</p>
              </div>
              <div className="mt-3 max-h-[65vh] overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-relaxed text-zinc-200">
                {currentRow.lyrics?.trim() || "No lyrics in this row."}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Subscore annotation
              </p>
              <div className="mt-3 space-y-2">
                {SUBSCORE_DIMENSIONS.map((dim) => {
                  const subs = currentRow.ground_truth_subscores ?? defaultScores;
                  return (
                    <label key={dim} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-300">{dim}</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={subs[dim] ?? 3}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          if (!Number.isFinite(n)) return;
                          updateScore(currentRow.id, dim, Math.min(5, Math.max(1, n)));
                        }}
                        className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                      />
                    </label>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-zinc-500">
                Approved:{" "}
                <span className="text-zinc-300">
                  {currentRow.ground_truth_subscores_approved ? "true" : "false"}
                </span>
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveRow(currentRow, false)}
                  className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void saveRow(currentRow, true)}
                  className="rounded border border-amber-700 px-3 py-2 text-xs text-amber-200"
                >
                  Approve
                </button>
              </div>
            </section>
          </div>
        </div>
      : <p className="mt-4 text-sm text-zinc-500">No HITL rows loaded.</p>}
    </section>
  );
}
