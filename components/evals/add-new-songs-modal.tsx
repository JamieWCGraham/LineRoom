"use client";

import { useCallback, useMemo, useState } from "react";
import {
  evalSongInputSchema,
  parseEvalSongCsv,
  type EvalSongInput,
} from "@/lib/evals/evalSongInput";

type ExtendResult =
  | { status: "inserted"; title: string; artist: string; id: number }
  | { status: "failed"; title: string; artist: string; error: string };

const emptyRow = (): EvalSongInput => ({
  title: "",
  artist: "",
  genre: "",
  overall_score: "",
  rationale_short: "",
});

type Props = {
  open: boolean;
  onClose: () => void;
};

async function downloadEvalSetCsv(): Promise<string | null> {
  const res = await fetch("/api/evals/eval-set/export");
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return typeof data.error === "string" ? data.error : "Export failed.";
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  const match = cd?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "eval_set_export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return null;
}

export function AddNewSongsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<"csv" | "manual">("csv");
  const [csvText, setCsvText] = useState("");
  const [manualRows, setManualRows] = useState<EvalSongInput[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ExtendResult[] | null>(null);

  const resetForm = useCallback(() => {
    setCsvText("");
    setManualRows([emptyRow()]);
    setError(null);
    setResults(null);
    setTab("csv");
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const collectRows = useCallback((): EvalSongInput[] => {
    if (tab === "csv") {
      return parseEvalSongCsv(csvText);
    }
    const out: EvalSongInput[] = [];
    for (let i = 0; i < manualRows.length; i++) {
      const raw = manualRows[i]!;
      if (
        !raw.title.trim() &&
        !raw.artist.trim() &&
        !raw.genre.trim() &&
        !raw.overall_score.trim() &&
        !raw.rationale_short.trim()
      ) {
        continue;
      }
      const parsed = evalSongInputSchema.safeParse({
        ...raw,
        title: raw.title.trim(),
        artist: raw.artist.trim(),
        genre: raw.genre.trim(),
        overall_score: raw.overall_score.trim(),
        rationale_short: raw.rationale_short.trim(),
      });
      if (!parsed.success) {
        throw new Error(`Manual row ${i + 1}: ${parsed.error.flatten().formErrors.join("; ")}`);
      }
      out.push(parsed.data);
    }
    if (out.length === 0) {
      throw new Error("Add at least one song (title, artist, overall_score are required).");
    }
    return out;
  }, [csvText, manualRows, tab]);

  const onSubmit = async () => {
    setError(null);
    setResults(null);
    let rows: EvalSongInput[];
    try {
      rows = collectRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid input.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/evals/eval-set/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: ExtendResult[];
        error?: string;
        detail?: unknown;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Request failed.",
        );
        return;
      }
      const list = data.results ?? [];
      setResults(list);

      const exportErr = await downloadEvalSetCsv();
      if (exportErr) {
        setError(exportErr);
      }
    } finally {
      setBusy(false);
    }
  };

  const manualHint = useMemo(
    () =>
      "Required: title, artist, overall_score. Genre may be comma-separated tags or a JSON array string.",
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-songs-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="max-h-[min(90dvh,40rem)] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <h2
              id="add-songs-title"
              className="text-sm font-semibold text-zinc-100"
            >
              Add New Songs
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Lyrics are resolved via lyrics.ovh and LRCLIB, then rows are
              inserted into <code className="text-zinc-400">generate_critique_eval_set</code>.
              The full eval set CSV downloads after submit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="flex gap-2 border-b border-zinc-800 px-4 pt-2">
          <button
            type="button"
            onClick={() => setTab("csv")}
            className={`rounded-t-md px-3 py-2 text-xs font-medium ${
              tab === "csv" ?
                "bg-zinc-900 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`rounded-t-md px-3 py-2 text-xs font-medium ${
              tab === "manual" ?
                "bg-zinc-900 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Manual
          </button>
        </div>

        <div className="max-h-[min(55dvh,28rem)] overflow-y-auto px-4 py-3">
          {tab === "csv" ?
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                First row:{" "}
                <code className="text-zinc-400">
                  title,artist,genre,overall_score,rationale_short
                </code>
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={12}
                placeholder={`title,artist,genre,overall_score,rationale_short\nExample Song,Example Artist,pop,Strong,Calibration anchor.`}
                className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          : <div className="space-y-3">
              <p className="text-xs text-zinc-500">{manualHint}</p>
              {manualRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 sm:grid-cols-2"
                >
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-zinc-500">Title</span>
                    <input
                      value={row.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManualRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, title: v } : r)),
                        );
                      }}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-zinc-500">Artist</span>
                    <input
                      value={row.artist}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManualRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, artist: v } : r)),
                        );
                      }}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                    <span className="text-zinc-500">Genre</span>
                    <input
                      value={row.genre}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManualRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, genre: v } : r)),
                        );
                      }}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-zinc-500">overall_score</span>
                    <input
                      value={row.overall_score}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManualRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, overall_score: v } : r,
                          ),
                        );
                      }}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                    <span className="text-zinc-500">rationale_short</span>
                    <input
                      value={row.rationale_short}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManualRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, rationale_short: v } : r,
                          ),
                        );
                      }}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setManualRows((prev) => [...prev, emptyRow()])}
                className="text-xs font-medium text-amber-400/90 hover:text-amber-300"
              >
                + Add row
              </button>
            </div>
          }
        </div>

        {error ?
          <p className="mx-4 mb-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        : null}

        {results && results.length > 0 ?
          <div className="mx-4 mb-2 max-h-32 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs">
            <p className="font-medium text-zinc-400">Results</p>
            <ul className="mt-1 space-y-1 text-zinc-300">
              {results.map((r, i) => (
                <li key={i}>
                  {r.status === "inserted" ?
                    <span className="text-emerald-400">✓</span>
                  : <span className="text-red-400">✗</span>}{" "}
                  {r.title} — {r.artist}
                  {r.status === "inserted" ?
                    ` (id ${r.id})`
                  : ` — ${r.error}`}
                </li>
              ))}
            </ul>
          </div>
        : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              void downloadEvalSetCsv().then((err) => {
                if (err) setError(err);
              });
            }}
            disabled={busy}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
          >
            Download eval set CSV
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy}
            className="rounded-lg bg-amber-600/90 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
