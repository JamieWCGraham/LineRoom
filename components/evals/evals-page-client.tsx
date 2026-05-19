"use client";

import Link from "next/link";
import { EvalCritiquePreview } from "@/components/evals/EvalCritiquePreview";
import { EvalMetricsPanel } from "@/components/evals/EvalMetricsPanel";
import { EvalRunSelector } from "@/components/evals/EvalRunSelector";
import { GroundTruthTable } from "@/components/evals/GroundTruthTable";
import { LineFeedbackDrilldown } from "@/components/evals/LineFeedbackDrilldown";
import { StrengthWeaknessDrilldown } from "@/components/evals/StrengthWeaknessDrilldown";
import { useEvalRunData } from "@/components/evals/useEvalRunData";

type Props = {
  email: string;
};

export function EvalsPageClient({ email }: Props) {
  const data = useEvalRunData();

  const groundTruthRows = data.metrics?.groundTruthRows ?? [];
  const metricsResetKey = data.metrics?.runId ?? "";

  return (
    <div className="mt-8 space-y-6">
      <EvalRunSelector
        email={email}
        addSongsOpen={data.addSongsOpen}
        setAddSongsOpen={data.setAddSongsOpen}
        batchBusy={data.batchBusy}
        batchMessage={data.batchMessage}
        batchRunId={data.batchRunId}
        batchCompleted={data.batchCompleted}
        batchTotalRows={data.batchTotalRows}
        progressRatio={data.progressRatio}
        onStartBatch={data.startBatch}
        onRefreshRuns={data.refreshRuns}
        runs={data.runs}
        runId={data.runId}
        onRunIdChange={data.setRunId}
        ids={data.ids}
        evalId={data.evalId}
        onEvalIdChange={data.setEvalId}
        idx={data.idx}
        onGoPrev={data.goPrev}
        onGoNext={data.goNext}
        retryBusy={data.retryBusy}
        onRetryCurrentRow={data.retryCurrentRow}
        metricsLoading={data.metricsLoading}
        metricsVisible={data.metricsVisible}
        onMetricsButtonClick={data.onMetricsButtonClick}
      />

      {data.metricsError ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {data.metricsError}
        </p>
      : null}

      {data.metrics && data.metricsVisible ?
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <EvalMetricsPanel metrics={data.metrics} />
          {groundTruthRows.length > 0 ?
            <>
              <GroundTruthTable rows={groundTruthRows} resetKey={metricsResetKey} />
              <StrengthWeaknessDrilldown
                rows={groundTruthRows}
                resetKey={metricsResetKey}
                onSelectEvalId={data.setEvalId}
              />
              <LineFeedbackDrilldown
                rows={groundTruthRows}
                resetKey={metricsResetKey}
                onSelectEvalId={data.setEvalId}
              />
            </>
          : null}
        </section>
      : null}

      {data.listError ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {data.listError}
        </p>
      : null}

      {data.loadError && !data.output?.error ?
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {data.loadError}
        </p>
      : null}

      {data.retryMessage ?
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {data.retryMessage}
        </p>
      : null}

      {data.output?.error ?
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Model/storage error for this row: {data.output.error}
        </p>
      : null}

      <EvalCritiquePreview
        output={data.output}
        critique={data.critique}
        fetchingOutput={data.fetchingOutput}
        lyrics={data.lyrics}
        title={data.title}
        genre={data.genre}
        similar={data.similar}
        lineFeedbackByIndex={data.lineFeedbackByIndex}
        lineFeedbackAutoShowKey={data.lineFeedbackAutoShowKey}
        selectedGroundTruthSubscores={data.selectedGroundTruthSubscores}
        selectedGroundTruthApproved={data.selectedGroundTruthApproved}
        selectedGroundTruthStrengthsWeaknesses={
          data.selectedGroundTruthStrengthsWeaknesses
        }
        selectedGroundTruthStrengthsWeaknessesApproved={
          data.selectedGroundTruthStrengthsWeaknessesApproved
        }
        selectedGroundTruthLineFeedback={data.selectedGroundTruthLineFeedback}
        selectedGroundTruthLineFeedbackApproved={
          data.selectedGroundTruthLineFeedbackApproved
        }
        selectedLineFeedbackEval={data.selectedLineFeedbackEval}
      />

      <p className="text-center text-xs text-zinc-600">
        <Link href="/" className="text-zinc-400 underline hover:text-zinc-200">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
