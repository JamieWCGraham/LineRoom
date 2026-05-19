"use client";

import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";
import { SUBSCORE_DIMENSIONS } from "@/lib/evals/subscoreCalibration";
import type { EvalRunMetricsResponse } from "@/components/evals/useEvalRunData";

type Props = {
  metrics: EvalRunMetricsResponse;
};

export function EvalMetricsPanel({ metrics }: Props) {
  const subscoreMetrics =
    metrics.subscoreCalibration ?? {
      comparedRows: 0,
      meanAbsoluteError: null,
      bandConsistencyPassRate: null,
      explanationAlignmentMean: null,
      byDimension: {},
    };
  const swMetrics =
    metrics.strengthWeaknessCalibration ?? {
      comparedRows: 0,
      meanSpecificity: null,
      meanEvidenceGrounding: null,
      meanNonRedundancy: null,
      meanActionability: null,
      meanFairness: null,
      meanCompositeRubric: null,
      failureFlagCounts: {},
    };
  const swFlagRows = Object.entries(swMetrics.failureFlagCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const lfMetrics =
    metrics.lineFeedbackCalibration ?? {
      comparedRows: 0,
      meanCoverage: null,
      meanLabelCalibration: null,
      meanSpecificity: null,
      meanRevisionUsefulness: null,
      meanContextAwareness: null,
      meanLineLevelComposite: null,
      failureFlagCounts: {},
    };
  const lfFlagRows = Object.entries(lfMetrics.failureFlagCounts).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
<h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
  Band accuracy (this run)
</h2>
<p className="mt-2 text-sm text-zinc-400">
  Exact match of model{" "}
  <code className="text-zinc-300">overallRatingBand</code> to table{" "}
  <code className="text-zinc-300">overall_score</code>.
</p>
<div className="mt-4 flex flex-wrap gap-6">
  <div>
    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      Total
    </p>
    <p className="mt-1 text-2xl font-semibold text-zinc-100">
      {metrics.totalAccuracy != null ?
        `${Math.round(metrics.totalAccuracy * 1000) / 10}%`
      : "—"}
    </p>
    <p className="mt-0.5 text-xs text-zinc-500">
      {metrics.totalCorrect} / {metrics.totalCompared} compared
    </p>
  </div>
</div>
<div className="mt-8">
  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
    Gold overall_score
  </h3>
  <p className="mt-1 text-xs text-zinc-500">
    Count and exact-match accuracy by gold band for this run.
  </p>
  <div className="mt-3 overflow-x-auto">
    <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
    <thead>
      <tr className="border-b border-zinc-700 text-xs uppercase tracking-wide text-zinc-500">
        <th className="py-2 pr-4 font-medium">Gold overall_score</th>
        <th className="py-2 pr-4 font-medium">Count</th>
        <th className="py-2 pr-4 font-medium">Correct</th>
        <th className="py-2 font-medium">Accuracy</th>
      </tr>
    </thead>
    <tbody>
      {CANONICAL_RATING_BANDS.map((band) => {
        const row = metrics.byOverallScore[band];
        if (!row) return null;
        return (
          <tr
            key={band}
            className="border-b border-zinc-800/80 text-zinc-300"
          >
            <td className="py-2 pr-4">{band}</td>
            <td className="py-2 pr-4">{row.count}</td>
            <td className="py-2 pr-4">{row.correct}</td>
            <td className="py-2">
              {row.accuracy != null ?
                `${Math.round(row.accuracy * 1000) / 10}%`
              : "—"}
            </td>
          </tr>
        );
      })}
    </tbody>
    </table>
  </div>
</div>
{(() => {
  const s = metrics.skipped;
  const parts: string[] = [];
  if (s.missingOutput.length > 0) {
    parts.push(`${s.missingOutput.length} missing output`);
  }
  if (s.missingPrediction.length > 0) {
    parts.push(`${s.missingPrediction.length} missing/invalid prediction`);
  }
  if (s.invalidGoldLabel.length > 0) {
    parts.push(`${s.invalidGoldLabel.length} invalid gold label`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="mt-4 text-xs leading-relaxed text-zinc-500">
      Skipped: {parts.join("; ")}.
    </p>
  );
})()}

{metrics.confusionMatrix ?
  <div className="mt-8">
    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
      Confusion matrix
    </h3>
    <p className="mt-1 text-xs text-zinc-500">
      Rows = ground truth (
      <code className="text-zinc-400">overall_score</code> in Supabase).
      Columns = model prediction (
      <code className="text-zinc-400">overallRatingBand</code>).
    </p>
    <div className="mt-3 overflow-x-auto">
      <table className="border-collapse text-center text-xs">
        <thead>
          <tr>
            <th
              scope="col"
              className="border border-zinc-700 bg-zinc-950/80 px-2 py-2 text-left font-medium text-zinc-500"
            >
              GT / Pred
            </th>
            {CANONICAL_RATING_BANDS.map((pred) => (
              <th
                key={pred}
                scope="col"
                className="max-w-[5.5rem] border border-zinc-700 bg-zinc-950/80 px-1.5 py-2 align-bottom text-[10px] font-medium leading-tight text-zinc-400"
                title={pred}
              >
                {pred}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CANONICAL_RATING_BANDS.map((gold) => (
            <tr key={gold}>
              <th
                scope="row"
                className="max-w-[6rem] border border-zinc-700 bg-zinc-950/50 px-2 py-2 text-left text-[10px] font-medium leading-tight text-zinc-400"
                title={gold}
              >
                {gold}
              </th>
              {CANONICAL_RATING_BANDS.map((pred) => {
                const cell =
                  metrics.confusionMatrix[gold]?.[pred] ?? 0;
                const diag = gold === pred;
                return (
                  <td
                    key={pred}
                    className={`min-w-[2.5rem] border border-zinc-700 px-2 py-2 font-mono tabular-nums text-sm ${
                      diag ?
                        "bg-emerald-950/35 text-emerald-100"
                      : "text-zinc-200"
                    }`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
: null}
<div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
    Subscore calibration
  </p>
  <div className="mt-2 flex flex-wrap gap-6 text-sm">
    <p className="text-zinc-300">
      MAE:{" "}
      <span className="font-semibold text-zinc-100">
        {subscoreMetrics.meanAbsoluteError != null ?
          (Math.round(subscoreMetrics.meanAbsoluteError * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Band pass rate:{" "}
      <span className="font-semibold text-zinc-100">
        {subscoreMetrics.bandConsistencyPassRate != null ?
          `${Math.round(subscoreMetrics.bandConsistencyPassRate * 1000) / 10}%`
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Explanation alignment mean:{" "}
      <span className="font-semibold text-zinc-100">
        {subscoreMetrics.explanationAlignmentMean != null ?
          (Math.round(subscoreMetrics.explanationAlignmentMean * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-500">
      n = {subscoreMetrics.comparedRows}
    </p>
  </div>
</div>
<div className="mt-8">
  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
    Subscore
  </h3>
  <div className="mt-3 overflow-x-auto">
    <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
    <thead>
      <tr className="border-b border-zinc-700 uppercase tracking-wide text-zinc-500">
        <th className="py-2 pr-4 font-medium">Subscore</th>
        <th className="py-2 pr-4 font-medium">MAE</th>
        <th className="py-2 pr-4 font-medium">Within ±1</th>
        <th className="py-2 font-medium">Failure (2+ off)</th>
      </tr>
    </thead>
    <tbody>
      {SUBSCORE_DIMENSIONS.map((dim) => {
        const row = subscoreMetrics.byDimension?.[dim];
        return (
          <tr key={dim} className="border-b border-zinc-800/80 text-zinc-300">
            <td className="py-2 pr-4 font-mono text-[11px]">{dim}</td>
            <td className="py-2 pr-4">
              {row?.meanAbsoluteError != null ?
                (Math.round(row.meanAbsoluteError * 100) / 100).toFixed(2)
              : "—"}
            </td>
            <td className="py-2 pr-4">
              {row?.withinToleranceRate != null ?
                `${Math.round(row.withinToleranceRate * 1000) / 10}%`
              : "—"}
            </td>
            <td className="py-2">
              {row?.failureRate != null ?
                `${Math.round(row.failureRate * 1000) / 10}%`
              : "—"}
            </td>
          </tr>
        );
      })}
    </tbody>
    </table>
  </div>
</div>
<div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
    Top strengths / weaknesses (LLM judge vs HITL reference)
  </p>
  <p className="mt-1 text-xs text-zinc-500">
    Means over rows where ground-truth bullets exist and this run stored{" "}
    <code className="text-zinc-400">strengthWeaknessEval</code> in{" "}
    <code className="text-zinc-400">output.json</code>.
  </p>
  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
    <p className="text-zinc-300">
      Composite rubric mean:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanCompositeRubric != null ?
          (Math.round(swMetrics.meanCompositeRubric * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Specificity:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanSpecificity != null ?
          (Math.round(swMetrics.meanSpecificity * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Evidence:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanEvidenceGrounding != null ?
          (Math.round(swMetrics.meanEvidenceGrounding * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Non-redundancy:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanNonRedundancy != null ?
          (Math.round(swMetrics.meanNonRedundancy * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Actionability:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanActionability != null ?
          (Math.round(swMetrics.meanActionability * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Fairness:{" "}
      <span className="font-semibold text-zinc-100">
        {swMetrics.meanFairness != null ?
          (Math.round(swMetrics.meanFairness * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-500">
      n = {swMetrics.comparedRows}
    </p>
  </div>
</div>
<div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
    Failure flags (row counts)
  </h3>
  {swFlagRows.length > 0 ? (
    <ul className="mt-2 space-y-1 text-xs text-zinc-400">
      {swFlagRows.map(([flag, count]) => (
        <li key={flag}>
          <span className="font-mono text-zinc-300">{flag}</span>: {count}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-xs text-zinc-500">None in this run.</p>
  )}
</div>
<div className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
    Line-level feedback quality (LLM judge vs HITL reference)
  </p>
  <p className="mt-1 text-xs text-zinc-500">
    Means over rows where <code className="text-zinc-400">ground_truth_line_feedback</code>{" "}
    has must-hit lines and this run stored{" "}
    <code className="text-zinc-400">lineFeedbackEval</code> in{" "}
    <code className="text-zinc-400">output.json</code>. Composite uses architecture weights
    (coverage 25%, label calibration 20%, specificity / revision / context for the rest).
  </p>
  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
    <p className="text-zinc-300">
      Composite mean:{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanLineLevelComposite != null ?
          (Math.round(lfMetrics.meanLineLevelComposite * 1000) / 1000).toFixed(3)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Coverage:{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanCoverage != null ?
          (Math.round(lfMetrics.meanCoverage * 1000) / 10).toFixed(1) + "%"
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Label cal.:{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanLabelCalibration != null ?
          (Math.round(lfMetrics.meanLabelCalibration * 1000) / 10).toFixed(1) + "%"
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Specificity (1–5):{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanSpecificity != null ?
          (Math.round(lfMetrics.meanSpecificity * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Revision:{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanRevisionUsefulness != null ?
          (Math.round(lfMetrics.meanRevisionUsefulness * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-300">
      Context:{" "}
      <span className="font-semibold text-zinc-100">
        {lfMetrics.meanContextAwareness != null ?
          (Math.round(lfMetrics.meanContextAwareness * 100) / 100).toFixed(2)
        : "—"}
      </span>
    </p>
    <p className="text-zinc-500">n = {lfMetrics.comparedRows}</p>
  </div>
</div>
<div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
    Line feedback failure flags (row counts)
  </h3>
  {lfFlagRows.length > 0 ? (
    <ul className="mt-2 space-y-1 text-xs text-zinc-400">
      {lfFlagRows.map(([flag, count]) => (
        <li key={flag}>
          <span className="font-mono text-zinc-300">{flag}</span>: {count}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-xs text-zinc-500">None in this run.</p>
  )}
</div>
    </>
  );
}
