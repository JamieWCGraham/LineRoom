"use client";

import { useRef, useState } from "react";
import { useMobileToolbarInset } from "@/hooks/useMobileToolbarInset";
import type { CritiqueMeta, CritiqueResult } from "@/lib/types";
import type { LyricSubscoresJson } from "@/lib/evals/subscoreCalibration";
import type { GroundTruthStrengthsWeaknesses } from "@/lib/evals/strengthWeaknessGroundTruth";
import type { GroundTruthLineFeedback } from "@/lib/evals/lineFeedbackGroundTruth";
import type { LineFeedbackEvalSnapshot } from "@/lib/evals/lineFeedbackMetrics";

/** Short copy for judge `failure_flags` (line-level eval module). */
const LINE_FEEDBACK_FLAG_LABELS: Record<string, string> = {
  generic_line_notes: "Generic or boilerplate line notes",
  mislabeled_strength: "Strength label (strong / promising / suggestion) miscalibrated vs reference",
  missed_must_line: "Skipped or barely addressed a must-comment reference line",
  low_revision_leverage: "Constructive lines lack a useful revision direction",
  weak_context: "Note ignores how the line functions in the song",
  redundant_line_feedback: "Overlapping or redundant line-level entries",
};

function lineFeedbackFlagLabel(flag: string): string {
  const key = flag.trim();
  return LINE_FEEDBACK_FLAG_LABELS[key] ?? key.replace(/_/g, " ");
}

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
  quotaBadge?: string | null;
  groundTruthSubscores?: LyricSubscoresJson | null;
  groundTruthApproved?: boolean | null;
  /** Eval-set HITL reference bullets (when present on the eval row). */
  groundTruthStrengthsWeaknesses?: GroundTruthStrengthsWeaknesses | null;
  groundTruthStrengthsWeaknessesApproved?: boolean | null;
  groundTruthLineFeedback?: GroundTruthLineFeedback | null;
  groundTruthLineFeedbackApproved?: boolean | null;
  /** When viewing an eval run `output.json`, judge snapshot for line-level quality. */
  lineFeedbackEval?: LineFeedbackEvalSnapshot | null;
  /** Hide regenerate / quota footer (e.g. eval results viewer). */
  readOnly?: boolean;
  pieceTitle?: string;
  critiqueMeta?: CritiqueMeta;
  onCritiqueMetaChange?: (next: CritiqueMeta) => void;
};

export function CritiqueDisplayPanel({
  critique,
  loading,
  onRegenerate,
  lyricsEmpty,
  quotaBadge,
  groundTruthSubscores = null,
  groundTruthApproved = null,
  groundTruthStrengthsWeaknesses = null,
  groundTruthStrengthsWeaknessesApproved = null,
  groundTruthLineFeedback = null,
  groundTruthLineFeedbackApproved = null,
  lineFeedbackEval = null,
  readOnly = false,
  pieceTitle = "",
  critiqueMeta,
  onCritiqueMetaChange,
}: Props) {
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const mobileFooterRef = useRef<HTMLDivElement>(null);
  const mobileHeaderInsetPx = useMobileToolbarInset(mobileHeaderRef);
  const mobileFooterInsetPx = useMobileToolbarInset(mobileFooterRef);
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 max-lg:rounded-none max-lg:border-x-0">
      <div
        ref={mobileHeaderRef}
        className="shrink-0 border-b border-zinc-800/80 px-3 py-2 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-[50] max-lg:bg-zinc-950/95 max-lg:px-5 max-lg:pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.5rem))] max-lg:backdrop-blur-md lg:relative lg:z-auto lg:bg-transparent lg:px-3 lg:pb-2 lg:pt-3"
      >
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-300">
          Critique
        </h2>
      </div>

      <div
        className="shrink-0 lg:hidden"
        style={{ height: mobileHeaderInsetPx }}
        aria-hidden
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-3 pt-3 max-lg:px-5 [touch-action:pan-y] lg:pb-3 max-lg:pb-0">
        {critiqueMeta && onCritiqueMetaChange ? (
          <details className="mb-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-300">
              Piece context (for regenerate)
            </summary>
            <div className="mt-2 space-y-2 pb-1">
              <p className="text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-400">Title:</span>{" "}
                {pieceTitle.trim() || "Untitled piece"}
              </p>
              <input
                type="text"
                value={critiqueMeta.genre}
                onChange={(e) =>
                  onCritiqueMetaChange({
                    ...critiqueMeta,
                    genre: e.target.value,
                  })
                }
                disabled={loading}
                className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-700/40 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 disabled:opacity-50"
                style={{ colorScheme: "dark" }}
                placeholder="Genre"
              />
              <textarea
                value={critiqueMeta.similarArtists}
                onChange={(e) =>
                  onCritiqueMetaChange({
                    ...critiqueMeta,
                    similarArtists: e.target.value,
                  })
                }
                disabled={loading}
                rows={2}
                className="w-full resize-y rounded border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-700/40 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 disabled:opacity-50"
                style={{ colorScheme: "dark" }}
                placeholder="Similar writers / voice (lyrics or poetry)"
              />
            </div>
          </details>
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
              <p className="mt-1 text-2xl font-semibold text-emerald-200/95">
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
              {groundTruthSubscores ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Predicted vs ground truth
                  {groundTruthApproved == null ?
                    ""
                  : groundTruthApproved ?
                    " · GT approved"
                  : " · GT not approved"}
                </p>
              ) : null}
              <ul className="mt-1 space-y-1.5 text-zinc-300">
                {DIMENSION_LABELS.map(({ key, label }) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">
                      {label}
                    </span>
                    <span className="font-medium tabular-nums text-emerald-100/95">
                      {critique.subscores[key]}/5
                      {groundTruthSubscores ? (
                        <span className="ml-2 text-zinc-500">
                          vs {groundTruthSubscores[key]}/5
                        </span>
                      ) : null}
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
                  className="mt-2 text-xs font-medium text-emerald-300/90 hover:text-emerald-200"
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
              {groundTruthStrengthsWeaknesses != null ?
                <div className="mt-3 rounded-lg border border-teal-800/50 bg-teal-950/25 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-teal-500/95">
                    Eval set reference (gold strengths)
                    {groundTruthStrengthsWeaknessesApproved ?
                      <span className="ml-1.5 font-normal text-teal-400/90">· approved</span>
                    : null}
                  </p>
                  {groundTruthStrengthsWeaknesses.overallStrengths.length === 0 ?
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                      No gold strength bullets on this eval row.
                    </p>
                  : (
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-teal-100/90">
                      {groundTruthStrengthsWeaknesses.overallStrengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              : null}
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
              {groundTruthStrengthsWeaknesses != null ?
                <div className="mt-3 rounded-lg border border-teal-800/50 bg-teal-950/25 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-teal-500/95">
                    Eval set reference (gold weaknesses)
                    {groundTruthStrengthsWeaknessesApproved ?
                      <span className="ml-1.5 font-normal text-teal-400/90">· approved</span>
                    : null}
                  </p>
                  {groundTruthStrengthsWeaknesses.overallWeaknesses.length === 0 ?
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                      No gold weakness bullets on this eval row.
                    </p>
                  : (
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-teal-100/90">
                      {groundTruthStrengthsWeaknesses.overallWeaknesses.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              : null}
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
                        (item.category === "praise" ? "strong" : "suggestion");
                      const quotedClass =
                        strength === "strong" ?
                          "border-l-2 border-green-600/75 pl-2 font-mono text-[13px] leading-snug text-zinc-100"
                        : strength === "promising" ?
                          "border-l-2 border-blue-500/80 pl-2 font-mono text-[13px] leading-snug text-sky-100"
                        : "border-l-2 border-violet-400/70 pl-2 font-mono text-[13px] leading-snug text-violet-100";
                      const labelClass =
                        strength === "strong" ?
                          "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-green-300/90"
                        : strength === "promising" ?
                          "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-sky-300/90"
                        : "mt-1 pl-2 text-[11px] font-medium uppercase tracking-wide text-violet-300/90";
                      const strengthLabel =
                        strength === "strong" ? "Strong"
                        : strength === "promising" ? "Promising"
                        : "Suggestion";
                      return (
                        <>
                          <p className={quotedClass}>{item.quotedLine || "—"}</p>
                          <p className={labelClass}>{strengthLabel}</p>
                          <p className="mt-1.5 pl-2 text-[13px] leading-relaxed text-zinc-400">
                            {item.feedback}
                          </p>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
              {groundTruthLineFeedback != null || lineFeedbackEval != null ?
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="min-w-0 rounded-lg border border-cyan-800/50 bg-cyan-950/25 px-3 py-2.5">
                    {groundTruthLineFeedback != null ?
                      <>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-500/95">
                          Eval set reference (must-comment lines)
                          {groundTruthLineFeedbackApproved ?
                            <span className="ml-1.5 font-normal text-cyan-400/90">· approved</span>
                          : null}
                        </p>
                        {groundTruthLineFeedback.mustCommentLines.length === 0 ?
                          <p className="mt-1 text-[12px] text-zinc-500">None listed.</p>
                        : (
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-cyan-100/90">
                            {groundTruthLineFeedback.mustCommentLines.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        )}
                        {groundTruthLineFeedback.anchorLines.length > 0 ?
                          <>
                            <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-cyan-600/90">
                              Anchor notes
                            </p>
                            <ul className="mt-1 space-y-2 text-[12px] leading-relaxed text-cyan-100/85">
                              {groundTruthLineFeedback.anchorLines.map((a, i) => (
                                <li key={i} className="list-none">
                                  <p className="font-mono text-[11px] text-zinc-200">{a.quotedLine}</p>
                                  {(a.role || a.expectedStrength) ?
                                    <p className="mt-0.5 text-[11px] text-zinc-500">
                                      {[a.role, a.expectedStrength].filter(Boolean).join(" · ")}
                                    </p>
                                  : null}
                                  {a.rationale ?
                                    <p className="mt-0.5 text-zinc-400">{a.rationale}</p>
                                  : null}
                                </li>
                              ))}
                            </ul>
                          </>
                        : null}
                      </>
                    : (
                      <p className="text-[12px] leading-relaxed text-zinc-500">
                        No HITL line-level reference on this eval row.
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 rounded-lg border border-emerald-800/45 bg-emerald-950/20 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-500/95">
                      This run — line-level failures
                    </p>
                    {lineFeedbackEval != null ?
                      <>
                        {lineFeedbackEval.failure_flags.filter((f) => f.trim()).length === 0 ?
                          <p className="mt-1.5 text-[12px] text-emerald-400/90">
                            No failure flags — judge did not tag a line-level failure mode for this
                            song.
                          </p>
                        : (
                          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-emerald-100/90">
                            {lineFeedbackEval.failure_flags
                              .map((f) => f.trim())
                              .filter(Boolean)
                              .map((flag) => (
                                <li key={flag}>
                                  <span className="font-mono text-[11px] text-emerald-200/95">
                                    {flag}
                                  </span>
                                  <span className="block text-[11px] text-zinc-400">
                                    {lineFeedbackFlagLabel(flag)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                        {lineFeedbackEval.notes?.trim() ?
                          <p className="mt-2 border-t border-emerald-900/40 pt-2 text-[12px] leading-relaxed text-zinc-400">
                            {lineFeedbackEval.notes}
                          </p>
                        : null}
                        <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                          composite {(Math.round(lineFeedbackEval.line_level_composite * 1000) / 1000).toFixed(3)} ·
                          coverage {(Math.round(lineFeedbackEval.coverage * 1000) / 10).toFixed(1)}% · label cal.{" "}
                          {(Math.round(lineFeedbackEval.label_calibration * 1000) / 10).toFixed(1)}% · rubric{" "}
                          {lineFeedbackEval.specificity}/{lineFeedbackEval.revision_usefulness}/
                          {lineFeedbackEval.context_awareness} (1–5)
                        </p>
                      </>
                    : (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                        No line-level judge block in this output (e.g. missing HITL reference, judge
                        error, or run from before line-level eval was recorded).
                      </p>
                    )}
                  </div>
                </div>
              : null}
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
        {!readOnly ?
          <div
            className="shrink-0 lg:hidden"
            style={{ height: mobileFooterInsetPx }}
            aria-hidden
          />
        : null}
      </div>

      {!readOnly ?
        <div
          ref={mobileFooterRef}
          className="shrink-0 border-t border-zinc-800/80 p-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-lg:z-[50] max-lg:border-zinc-800/80 max-lg:bg-zinc-950/95 max-lg:px-5 max-lg:pb-3 max-lg:pt-2 max-lg:shadow-[0_-12px_32px_rgba(0,0,0,0.45)] max-lg:backdrop-blur-md lg:relative lg:bottom-auto lg:z-auto lg:bg-transparent lg:shadow-none"
        >
          {quotaBadge ?
            <p className="mb-2 text-center text-[11px] font-medium text-zinc-500">
              {quotaBadge}
            </p>
          : null}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading || !critique || lyricsEmpty}
            style={{ touchAction: "manipulation" }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-emerald-800/50 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-300"
                  aria-hidden
                />
                {critique ? "Regenerating critique..." : "Generating critique..."}
              </span>
            ) : (
              critique ? "Regenerate Critique" : "Generate Critique"
            )}
          </button>
          {loading ? (
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              {critique
                ? "Regenerating critique can take up to 1-2 minutes."
                : "Generating a new critique can take up to 1-2 minutes."}
            </p>
          ) : null}
        </div>
      : null}
    </div>
  );
}
