"use client";

import { useState } from "react";
import type { CritiqueResult } from "@/lib/types";

const DIMENSION_LABELS: Array<{
  key: keyof CritiqueResult["subscores"];
  label: string;
}> = [
  { key: "emotional_impact", label: "emotional impact" },
  { key: "imagery_specificity", label: "imagery specificity" },
  { key: "originality_voice", label: "originality and voice" },
  { key: "prosody_singability", label: "prosody and singability" },
  { key: "structure_cohesion", label: "structure and cohesion" },
  { key: "lyrical_economy", label: "lyrical economy" },
  { key: "hook_strength", label: "hook strength" },
];

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
  const [showFullGenrePrinciples, setShowFullGenrePrinciples] = useState(false);
  const genrePrinciplesText = critique?.genrePrinciples ?? "";
  const genrePrinciplesMaxChars = 420;
  const genrePrinciplesIsLong =
    genrePrinciplesText.length > genrePrinciplesMaxChars;
  const visibleGenrePrinciples =
    !genrePrinciplesIsLong || showFullGenrePrinciples ?
      genrePrinciplesText
    : `${genrePrinciplesText.slice(0, genrePrinciplesMaxChars).trimEnd()}...`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="shrink-0 border-b border-zinc-800/80 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Critique
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
          Saved after generation. Line notes below match green/yellow/red highlights in
          the draft (hover there for the same detail).
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!critique && !loading ? (
          <p className="text-center text-sm leading-relaxed text-zinc-600">
            Your critique will appear here after you click{" "}
            <span className="text-zinc-500">Generate Critique</span> in the Chat panel.
          </p>
        ) : null}

        {loading && !critique ? (
          <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-400"
              aria-hidden
            />
            Generating critique... this may take up to 1-2 minutes.
          </p>
        ) : null}

        {critique ? (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Overall rating
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-200/95">
                {critique.overallRatingBand}
              </p>
              {critique.analyzedSongVersion != null ? (
                <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                  <span className="font-medium text-zinc-400">
                    Version analyzed:
                  </span>{" "}
                  {critique.analyzedSongVersion}
                  {critique.priorSongVersionCompared != null ?
                    <>
                      {" "}
                      <span className="text-zinc-600">·</span>{" "}
                      <span className="font-medium text-zinc-400">
                        Compared to version:
                      </span>{" "}
                      {critique.priorSongVersionCompared}
                    </>
                  : null}
                </p>
              ) : null}
              {critique.comparedToSummary ? (
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                  {critique.comparedToSummary}
                </p>
              ) : null}
              {critique.overallBandRationale ? (
                <p className="mt-1 leading-relaxed text-zinc-400">
                  {critique.overallBandRationale}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Subscores
              </p>
              <ul className="mt-1 space-y-1.5 text-zinc-300">
                {DIMENSION_LABELS.map(({ key, label }) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">
                      {label}
                    </span>
                    <span className="font-medium tabular-nums text-amber-100/95">
                      {critique.subscores[key]}/5
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Genre principles
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-300">
                {visibleGenrePrinciples}
              </p>
              {genrePrinciplesIsLong ? (
                <button
                  type="button"
                  onClick={() => setShowFullGenrePrinciples((v) => !v)}
                  className="mt-2 text-xs font-medium text-amber-300/90 hover:text-amber-200"
                >
                  {showFullGenrePrinciples ? "See less" : "See more"}
                </button>
              ) : null}
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
                    {(() => {
                      const strength =
                        item.strength ??
                        (item.category === "praise" ? "strong" : "weak");
                      const quotedClass =
                        strength === "strong" ?
                          "border-l-2 border-emerald-400/80 pl-2 font-mono text-[13px] leading-snug text-emerald-100"
                        : strength === "promising" ?
                          "border-l-2 border-amber-300/85 pl-2 font-mono text-[13px] leading-snug text-amber-100"
                        : "border-l-2 border-rose-400/80 pl-2 font-mono text-[13px] leading-snug text-rose-100";
                      const labelClass =
                        strength === "strong" ?
                          "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-emerald-300/90"
                        : strength === "promising" ?
                          "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-amber-300/90"
                        : "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-rose-300/90";
                      const strengthLabel =
                        strength === "strong" ? "Strong"
                        : strength === "promising" ? "Promising / Tweakable"
                        : "Weak";
                      return (
                        <>
                    <p
                      className={quotedClass}
                    >
                      {item.quotedLine || "—"}
                    </p>
                    <p
                      className={labelClass}
                    >
                      {strengthLabel}
                    </p>
                    <p className="mt-1.5 pl-2 text-[13px] leading-relaxed text-zinc-400">
                      {item.feedback}
                    </p>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {loading && critique ? (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-500">
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-400"
              aria-hidden
            />
            Refreshing critique... this may take up to 1-2 minutes.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-800/80 p-3">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading || !critique || lyricsEmpty}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-amber-800/50 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-300"
                aria-hidden
              />
              Regenerating critique...
            </span>
          ) : (
            "Regenerate Critique"
          )}
        </button>
        {loading ? (
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            Regenerating critique can take up to 1-2 minutes.
          </p>
        ) : null}
      </div>
    </div>
  );
}
