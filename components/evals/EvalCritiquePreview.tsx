"use client";

import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { DraftEditor } from "@/components/DraftEditor";
import type { LineAnnotation } from "@/lib/lineAnnotations";
import type { CritiqueResult } from "@/lib/types";
import type { EvalOutputJson } from "@/components/evals/useEvalRunData";

type Props = {
  output: EvalOutputJson | null;
  critique: CritiqueResult | null;
  fetchingOutput: boolean;
  lyrics: string;
  title: string;
  genre: string;
  similar: string;
  lineFeedbackByIndex: Map<number, LineAnnotation[]>;
  lineFeedbackAutoShowKey: string;
  selectedGroundTruthSubscores: ReturnType<
    typeof import("@/lib/evals/subscoreCalibration").parseGroundTruthSubscores
  >;
  selectedGroundTruthApproved: boolean | null;
  selectedGroundTruthStrengthsWeaknesses: ReturnType<
    typeof import("@/lib/evals/strengthWeaknessGroundTruth").parseGroundTruthStrengthsWeaknesses
  >;
  selectedGroundTruthStrengthsWeaknessesApproved: boolean | null;
  selectedGroundTruthLineFeedback: ReturnType<
    typeof import("@/lib/evals/lineFeedbackGroundTruth").parseGroundTruthLineFeedback
  >;
  selectedGroundTruthLineFeedbackApproved: boolean | null;
  selectedLineFeedbackEval: ReturnType<
    typeof import("@/lib/evals/lineFeedbackMetrics").parseLineFeedbackEvalFromOutputJson
  >;
};

export function EvalCritiquePreview({
  output,
  critique,
  fetchingOutput,
  lyrics,
  title,
  genre,
  similar,
  lineFeedbackByIndex,
  lineFeedbackAutoShowKey,
  selectedGroundTruthSubscores,
  selectedGroundTruthApproved,
  selectedGroundTruthStrengthsWeaknesses,
  selectedGroundTruthStrengthsWeaknessesApproved,
  selectedGroundTruthLineFeedback,
  selectedGroundTruthLineFeedbackApproved,
  selectedLineFeedbackEval,
}: Props) {
  return (
    <div className="grid min-h-[min(70dvh,40rem)] gap-4 lg:grid-cols-2 lg:gap-5">
      <div className="flex min-h-[min(50dvh,28rem)] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 px-1 pb-1 pt-2 lg:min-h-0 lg:flex-1 lg:p-2">
        <DraftEditor
          value={fetchingOutput ? "" : lyrics}
          onChange={() => {}}
          readOnly
          lineFeedbackByIndex={lineFeedbackByIndex}
          lineFeedbackAutoShowKey={lineFeedbackAutoShowKey}
          addToChatEnabled={false}
          showFeedbackToggle
          placeholder={
            fetchingOutput ? "Loading…" : "No draft in this result."
          }
          copyButtonIdleLabel="Copy draft"
          textInputAriaLabel="Eval result draft"
          headerLeading={
            <div className="min-w-0 pr-2">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Draft
              </div>
              <p className="mt-1 truncate text-sm text-zinc-300">{title}</p>
              {(genre || similar) ?
                <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                  {[genre && `Genre: ${genre}`, similar && `Reference: ${similar}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              : null}
              {output?.elapsedMs != null ?
                <p className="mt-1 text-[11px] text-zinc-600">
                  Generated in {output.elapsedMs} ms
                </p>
              : null}
            </div>
          }
        />
      </div>

      <div className="flex min-h-[min(50dvh,24rem)] min-h-0 flex-col lg:min-h-0">
        <CritiqueDisplayPanel
          critique={critique}
          loading={fetchingOutput}
          onRegenerate={() => {}}
          lyricsEmpty={!lyrics.trim()}
          groundTruthSubscores={selectedGroundTruthSubscores}
          groundTruthApproved={selectedGroundTruthApproved}
          groundTruthStrengthsWeaknesses={selectedGroundTruthStrengthsWeaknesses}
          groundTruthStrengthsWeaknessesApproved={
            selectedGroundTruthStrengthsWeaknessesApproved
          }
          groundTruthLineFeedback={selectedGroundTruthLineFeedback}
          groundTruthLineFeedbackApproved={selectedGroundTruthLineFeedbackApproved}
          lineFeedbackEval={selectedLineFeedbackEval}
          readOnly
        />
      </div>
    </div>
  );
}
