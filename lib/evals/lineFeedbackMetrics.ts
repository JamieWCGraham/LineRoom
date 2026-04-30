import type { LineFeedbackQualityJudgeResult } from "./lineFeedbackJudge";

export type LineFeedbackEvalSnapshot = Pick<
  LineFeedbackQualityJudgeResult,
  | "coverage"
  | "label_calibration"
  | "specificity"
  | "revision_usefulness"
  | "context_awareness"
  | "failure_flags"
> & {
  notes?: string;
  /** Architecture-weighted composite in [0, 1]. */
  line_level_composite: number;
};

const FLOAT_KEYS = ["coverage", "label_calibration"] as const;
const INT_KEYS = ["specificity", "revision_usefulness", "context_awareness"] as const;

/** EVAL_ARCHITECTURE §4 suggested weights (normalized to [0,1] per axis). */
export function lineFeedbackWeightedComposite(
  j: Pick<
    LineFeedbackQualityJudgeResult,
    | "coverage"
    | "label_calibration"
    | "specificity"
    | "revision_usefulness"
    | "context_awareness"
  >,
): number {
  const norm15 = (x: number) => (x - 1) / 4;
  return (
    0.25 * j.coverage +
    0.2 * j.label_calibration +
    0.2 * norm15(j.specificity) +
    0.2 * norm15(j.revision_usefulness) +
    0.15 * norm15(j.context_awareness)
  );
}

export function lineFeedbackJudgeToSnapshot(
  j: LineFeedbackQualityJudgeResult,
): LineFeedbackEvalSnapshot {
  return {
    coverage: j.coverage,
    label_calibration: j.label_calibration,
    specificity: j.specificity,
    revision_usefulness: j.revision_usefulness,
    context_awareness: j.context_awareness,
    failure_flags: j.failure_flags,
    notes: j.notes,
    line_level_composite: lineFeedbackWeightedComposite(j),
  };
}

export type LineFeedbackRunMetrics = {
  comparedRows: number;
  meanCoverage: number | null;
  meanLabelCalibration: number | null;
  meanSpecificity: number | null;
  meanRevisionUsefulness: number | null;
  meanContextAwareness: number | null;
  meanLineLevelComposite: number | null;
  failureFlagCounts: Record<string, number>;
};

export function aggregateLineFeedbackRunMetrics(
  snapshots: Array<LineFeedbackEvalSnapshot | null | undefined>,
): LineFeedbackRunMetrics {
  const valid = snapshots.filter((s): s is LineFeedbackEvalSnapshot => s != null);
  const n = valid.length;
  if (n === 0) {
    return {
      comparedRows: 0,
      meanCoverage: null,
      meanLabelCalibration: null,
      meanSpecificity: null,
      meanRevisionUsefulness: null,
      meanContextAwareness: null,
      meanLineLevelComposite: null,
      failureFlagCounts: {},
    };
  }

  let sumCov = 0;
  let sumLab = 0;
  let sumSpec = 0;
  let sumRev = 0;
  let sumCtx = 0;
  let sumComp = 0;
  const flagCounts: Record<string, number> = {};
  for (const s of valid) {
    sumCov += s.coverage;
    sumLab += s.label_calibration;
    sumSpec += s.specificity;
    sumRev += s.revision_usefulness;
    sumCtx += s.context_awareness;
    sumComp += s.line_level_composite;
    for (const f of s.failure_flags) {
      const key = f.trim();
      if (!key) continue;
      flagCounts[key] = (flagCounts[key] ?? 0) + 1;
    }
  }
  const mean = (x: number) => x / n;
  return {
    comparedRows: n,
    meanCoverage: mean(sumCov),
    meanLabelCalibration: mean(sumLab),
    meanSpecificity: mean(sumSpec),
    meanRevisionUsefulness: mean(sumRev),
    meanContextAwareness: mean(sumCtx),
    meanLineLevelComposite: mean(sumComp),
    failureFlagCounts: flagCounts,
  };
}

export function parseLineFeedbackEvalFromOutputJson(
  parsed: unknown,
): LineFeedbackEvalSnapshot | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const lf = o.lineFeedbackEval;
  if (!lf || typeof lf !== "object") return null;
  const r = lf as Record<string, unknown>;
  for (const k of FLOAT_KEYS) {
    const v = r[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
  }
  for (const k of INT_KEYS) {
    const v = r[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
  }
  const comp = r.line_level_composite;
  if (typeof comp !== "number" || !Number.isFinite(comp)) return null;
  const flags = r.failure_flags;
  const failure_flags =
    Array.isArray(flags) ?
      flags.filter((x): x is string => typeof x === "string")
    : [];
  const notesRaw = r.notes;
  const notes = typeof notesRaw === "string" ? notesRaw : undefined;
  return {
    coverage: r.coverage as number,
    label_calibration: r.label_calibration as number,
    specificity: r.specificity as number,
    revision_usefulness: r.revision_usefulness as number,
    context_awareness: r.context_awareness as number,
    failure_flags,
    notes,
    line_level_composite: comp,
  };
}
