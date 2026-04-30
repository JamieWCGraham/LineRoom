"use client";

import { useEffect, useState } from "react";
import { SUBSCORE_DIMENSIONS } from "@/lib/evals/subscoreCalibration";
import type { GroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessGroundTruth";
import { emptyGroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessGroundTruth";
import type { GroundTruthLineFeedback } from "@/lib/evals/lineFeedbackGroundTruth";
import {
  emptyGroundTruthLineFeedback,
  groundTruthLineFeedbackSchema,
  parseGroundTruthLineFeedback,
} from "@/lib/evals/lineFeedbackGroundTruth";

type HitlRow = {
  id: number;
  title: string | null;
  artist: string | null;
  lyrics: string | null;
  overall_score: string | null;
  ground_truth_subscores: Record<string, number> | null;
  ground_truth_subscores_approved: boolean | null;
  ground_truth_strengths_weaknesses: GroundTruthStrengthsWeaknesses | null;
  ground_truth_strengths_weaknesses_approved: boolean | null;
  ground_truth_line_feedback: GroundTruthLineFeedback | null;
  ground_truth_line_feedback_approved: boolean | null;
};

const defaultScores: Record<string, number> = Object.fromEntries(
  SUBSCORE_DIMENSIONS.map((d) => [d, 3]),
);

function bulletsFromTextarea(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function textareaFromBullets(items: string[]): string {
  return items.join("\n");
}

export function EvalsHitlClient() {
  const [rows, setRows] = useState<HitlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [swStrengthsText, setSwStrengthsText] = useState("");
  const [swWeaknessesText, setSwWeaknessesText] = useState("");
  const [lfMustText, setLfMustText] = useState("");
  const [lfOptionalText, setLfOptionalText] = useState("");
  const [lfAnchorsJson, setLfAnchorsJson] = useState("[]");

  const loadRows = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const pageSize = 200;
      const acc: HitlRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const res = await fetch(
          `/api/evals/hitl?limit=${pageSize}&offset=${offset}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          rows?: HitlRow[];
          error?: string;
        };
        if (!res.ok) {
          setMessage(data.error ?? "Failed to load HITL rows.");
          return;
        }
        const chunk = data.rows ?? [];
        acc.push(...chunk);
        if (chunk.length < pageSize) break;
      }
      const nextRows = acc;
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

  const selectedIndex = rows.findIndex((r) => r.id === selectedSongId);
  const currentRow =
    selectedIndex >= 0 ? rows[selectedIndex]
    : rows.length > 0 ? rows[0]
    : null;

  useEffect(() => {
    if (!currentRow) {
      setSwStrengthsText("");
      setSwWeaknessesText("");
      setLfMustText("");
      setLfOptionalText("");
      setLfAnchorsJson("[]");
      return;
    }
    const sw =
      currentRow.ground_truth_strengths_weaknesses ?? emptyGroundTruthStrengthsWeaknesses();
    setSwStrengthsText(textareaFromBullets(sw.overallStrengths));
    setSwWeaknessesText(textareaFromBullets(sw.overallWeaknesses));
    const lf =
      parseGroundTruthLineFeedback(currentRow.ground_truth_line_feedback) ??
      emptyGroundTruthLineFeedback();
    setLfMustText(textareaFromBullets(lf.mustCommentLines));
    setLfOptionalText(textareaFromBullets(lf.optionalCommentLines));
    setLfAnchorsJson(JSON.stringify(lf.anchorLines, null, 2));
  }, [
    currentRow?.id,
    currentRow?.ground_truth_strengths_weaknesses,
    currentRow?.ground_truth_line_feedback,
  ]);

  const saveSubscores = async (row: HitlRow, approved: boolean) => {
    const groundTruthSubscores = row.ground_truth_subscores ?? defaultScores;
    const res = await fetch(`/api/evals/hitl/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groundTruthSubscores, groundTruthSubscoresApproved: approved }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? `Failed to save subscores for row ${row.id}.`);
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
    setMessage(`Saved subscores for row ${row.id}.`);
  };

  const saveStrengthWeakness = async (row: HitlRow, approved: boolean) => {
    const groundTruthStrengthsWeaknesses: GroundTruthStrengthsWeaknesses = {
      overallStrengths: bulletsFromTextarea(swStrengthsText),
      overallWeaknesses: bulletsFromTextarea(swWeaknessesText),
    };
    const res = await fetch(`/api/evals/hitl/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groundTruthStrengthsWeaknesses,
        groundTruthStrengthsWeaknessesApproved: approved,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? `Failed to save strengths/weaknesses for row ${row.id}.`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ?
          {
            ...r,
            ground_truth_strengths_weaknesses: groundTruthStrengthsWeaknesses,
            ground_truth_strengths_weaknesses_approved: approved,
          }
        : r,
      ),
    );
    setMessage(`Saved top strengths/weaknesses for row ${row.id}.`);
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

  const saveLineFeedback = async (row: HitlRow, approved: boolean) => {
    let parsedAnchors: unknown;
    try {
      parsedAnchors = JSON.parse(lfAnchorsJson) as unknown;
    } catch {
      setMessage("Invalid JSON in anchor lines.");
      return;
    }
    const candidate: GroundTruthLineFeedback = {
      mustCommentLines: bulletsFromTextarea(lfMustText),
      optionalCommentLines: bulletsFromTextarea(lfOptionalText),
      anchorLines: Array.isArray(parsedAnchors) ? parsedAnchors : [],
    };
    const validated = groundTruthLineFeedbackSchema.safeParse(candidate);
    if (!validated.success) {
      setMessage("Line feedback reference failed validation. Check anchor JSON shape.");
      return;
    }
    const groundTruthLineFeedback = validated.data;
    const res = await fetch(`/api/evals/hitl/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groundTruthLineFeedback,
        groundTruthLineFeedbackApproved: approved,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? `Failed to save line feedback for row ${row.id}.`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ?
          {
            ...r,
            ground_truth_line_feedback: groundTruthLineFeedback,
            ground_truth_line_feedback_approved: approved,
          }
        : r,
      ),
    );
    setMessage(`Saved line-level feedback reference for row ${row.id}.`);
  };

  const generateBaseline = async (
    target: "subscores" | "strengths_weaknesses" | "line_feedback",
  ) => {
    setLoading(true);
    setMessage("Generating baseline annotations...");
    try {
      const res = await fetch("/api/evals/hitl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyMissing: true, target }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: Array<{ status: string }>;
        candidateRowCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Baseline generation failed.");
        return;
      }
      const updated =
        data.results?.filter((r) => r.status === "updated").length ?? 0;
      const cand =
        typeof data.candidateRowCount === "number" ? data.candidateRowCount : null;
      const label =
        target === "subscores" ? "subscores"
        : target === "strengths_weaknesses" ? "strengths / weaknesses"
        : "line-level feedback";
      setMessage(
        cand != null ?
          `Baseline (${label}) complete. Candidates: ${cand}. Updated ${updated} rows.`
        : `Baseline (${label}) complete. Updated ${updated} rows.`,
      );
      await loadRows();
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-sm font-medium text-zinc-200">HITL annotations</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Subscores, strengths / weaknesses, and line-level feedback references for calibration
            evals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generateBaseline("subscores")}
            disabled={loading}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-100 disabled:opacity-40"
          >
            Baseline subscores (missing)
          </button>
          <button
            type="button"
            onClick={() => void generateBaseline("strengths_weaknesses")}
            disabled={loading}
            className="rounded-lg border border-teal-800/60 bg-teal-950/30 px-3 py-2 text-xs font-medium text-teal-100 disabled:opacity-40"
          >
            Baseline strengths / weaknesses (missing)
          </button>
          <button
            type="button"
            onClick={() => void generateBaseline("line_feedback")}
            disabled={loading}
            className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-2 text-xs font-medium text-cyan-100 disabled:opacity-40"
          >
            Baseline line feedback (missing)
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
                    {i + 1}. {row.title || "(untitled)"} — {row.artist || "Unknown"}{" "}
                    {row.ground_truth_subscores_approved ? "S✓" : ""}
                    {row.ground_truth_strengths_weaknesses_approved ? " W✓" : ""}
                    {row.ground_truth_line_feedback_approved ? " L✓" : ""}
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

            <div className="space-y-4">
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
                    onClick={() => void saveSubscores(currentRow, false)}
                    className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200"
                  >
                    Save subscores
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSubscores(currentRow, true)}
                    className="rounded border border-amber-700 px-3 py-2 text-xs text-amber-200"
                  >
                    Approve subscores
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Top strengths / weaknesses (one bullet per line)
                </p>
                <label className="mt-3 block">
                  <span className="text-[11px] text-zinc-500">Overall strengths</span>
                  <textarea
                    value={swStrengthsText}
                    onChange={(e) => setSwStrengthsText(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[11px] text-zinc-500">Overall weaknesses</span>
                  <textarea
                    value={swWeaknessesText}
                    onChange={(e) => setSwWeaknessesText(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
                  />
                </label>
                <p className="mt-4 text-xs text-zinc-500">
                  Approved:{" "}
                  <span className="text-zinc-300">
                    {currentRow.ground_truth_strengths_weaknesses_approved ? "true" : "false"}
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveStrengthWeakness(currentRow, false)}
                    className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200"
                  >
                    Save bullets
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveStrengthWeakness(currentRow, true)}
                    className="rounded border border-teal-700 px-3 py-2 text-xs text-teal-100"
                  >
                    Approve bullets
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Line-level feedback quality (HITL reference)
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  One lyric fragment per line for must-hit and optional lists. Anchor JSON is an
                  array of objects with quotedLine, optional role, expectedStrength, rationale.
                </p>
                <label className="mt-3 block">
                  <span className="text-[11px] text-zinc-500">Must-comment lines</span>
                  <textarea
                    value={lfMustText}
                    onChange={(e) => setLfMustText(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[11px] text-zinc-500">Optional lines</span>
                  <textarea
                    value={lfOptionalText}
                    onChange={(e) => setLfOptionalText(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[11px] text-zinc-500">Anchor lines (JSON array)</span>
                  <textarea
                    value={lfAnchorsJson}
                    onChange={(e) => setLfAnchorsJson(e.target.value)}
                    rows={8}
                    spellCheck={false}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-100"
                  />
                </label>
                <p className="mt-4 text-xs text-zinc-500">
                  Approved:{" "}
                  <span className="text-zinc-300">
                    {currentRow.ground_truth_line_feedback_approved ? "true" : "false"}
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveLineFeedback(currentRow, false)}
                    className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200"
                  >
                    Save line reference
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveLineFeedback(currentRow, true)}
                    className="rounded border border-cyan-700 px-3 py-2 text-xs text-cyan-100"
                  >
                    Approve line reference
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      : <p className="mt-4 text-sm text-zinc-500">No HITL rows loaded.</p>}
    </section>
  );
}
