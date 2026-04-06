"use client";

import type { CritiqueResult } from "@/lib/types";

type Props = {
  critique: CritiqueResult | null;
  loading: boolean;
  onRegenerate: () => void;
  lyricsEmpty: boolean;
};

export function CritiqueDisplayPanel({
  critique,
  loading,
  onRegenerate,
  lyricsEmpty,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="border-b border-zinc-800/80 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Critique
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
          Saved after generation. Line notes below match amber highlights in the
          draft (hover there for the same detail).
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!critique && !loading ? (
          <p className="text-center text-sm leading-relaxed text-zinc-600">
            Your critique will appear here after you click{" "}
            <span className="text-zinc-500">Generate Critique</span>.
          </p>
        ) : null}

        {loading && !critique ? (
          <p className="text-sm text-zinc-500">Generating critique…</p>
        ) : null}

        {critique ? (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Score
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-200/95">
                {critique.score}
                <span className="text-base font-normal text-zinc-500">
                  {" "}
                  / 10
                </span>
              </p>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Genre principles
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-300">
                {critique.genrePrinciples}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Overall strengths
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
                {critique.overallStrengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Overall weaknesses
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
                {critique.overallWeaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Line-level feedback
              </p>
              <ul className="mt-2 space-y-3 border-t border-zinc-800/80 pt-3">
                {critique.lineFeedback.map((item, i) => (
                  <li key={i} className="list-none">
                    <p className="border-l-2 border-amber-800/60 pl-2 font-mono text-[13px] leading-snug text-amber-100/90">
                      {item.quotedLine || "—"}
                    </p>
                    <p className="mt-1.5 pl-2 text-[13px] leading-relaxed text-zinc-400">
                      {item.feedback}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {loading && critique ? (
          <p className="mt-4 text-xs text-zinc-500">Refreshing critique…</p>
        ) : null}
      </div>

      <div className="border-t border-zinc-800/80 p-3">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading || !critique || lyricsEmpty}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-amber-800/50 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Regenerate Critique
        </button>
      </div>
    </div>
  );
}
