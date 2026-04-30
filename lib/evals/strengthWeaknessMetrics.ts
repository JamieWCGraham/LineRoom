import type { StrengthWeaknessQualityResult } from "./strengthWeaknessJudge";

export type StrengthWeaknessEvalSnapshot = Pick<
  StrengthWeaknessQualityResult,
  | "specificity"
  | "evidence_grounding"
  | "non_redundancy"
  | "actionability"
  | "fairness"
  | "failure_flags"
> & { notes?: string };

const SCORE_KEYS = [
  "specificity",
  "evidence_grounding",
  "non_redundancy",
  "actionability",
  "fairness",
] as const;
type RubricKey = (typeof SCORE_KEYS)[number];

export type StrengthWeaknessRunMetrics = {
  comparedRows: number;
  meanSpecificity: number | null;
  meanEvidenceGrounding: number | null;
  meanNonRedundancy: number | null;
  meanActionability: number | null;
  meanFairness: number | null;
  /** Mean of the five rubric scores (simple composite for the dashboard). */
  meanCompositeRubric: number | null;
  failureFlagCounts: Record<string, number>;
};

export function aggregateStrengthWeaknessRunMetrics(
  snapshots: Array<StrengthWeaknessEvalSnapshot | null | undefined>,
): StrengthWeaknessRunMetrics {
  const valid = snapshots.filter((s): s is StrengthWeaknessEvalSnapshot => s != null);
  const n = valid.length;
  if (n === 0) {
    return {
      comparedRows: 0,
      meanSpecificity: null,
      meanEvidenceGrounding: null,
      meanNonRedundancy: null,
      meanActionability: null,
      meanFairness: null,
      meanCompositeRubric: null,
      failureFlagCounts: {},
    };
  }

  const sums: Record<RubricKey, number> = {
    specificity: 0,
    evidence_grounding: 0,
    non_redundancy: 0,
    actionability: 0,
    fairness: 0,
  };
  const flagCounts: Record<string, number> = {};
  for (const s of valid) {
    for (const k of SCORE_KEYS) {
      sums[k] += s[k];
    }
    for (const f of s.failure_flags) {
      const key = f.trim();
      if (!key) continue;
      flagCounts[key] = (flagCounts[key] ?? 0) + 1;
    }
  }

  const mean = (sum: number) => sum / n;
  const rubricSum = SCORE_KEYS.reduce((acc, k) => acc + sums[k], 0);

  return {
    comparedRows: n,
    meanSpecificity: mean(sums.specificity),
    meanEvidenceGrounding: mean(sums.evidence_grounding),
    meanNonRedundancy: mean(sums.non_redundancy),
    meanActionability: mean(sums.actionability),
    meanFairness: mean(sums.fairness),
    meanCompositeRubric: mean(rubricSum / SCORE_KEYS.length),
    failureFlagCounts: flagCounts,
  };
}

/** Mean of the five rubric scores (1–5) for sorting and summaries. */
export function strengthWeaknessJudgeComposite(
  j: StrengthWeaknessEvalSnapshot | null | undefined,
): number | null {
  if (!j) return null;
  return (
    j.specificity +
    j.evidence_grounding +
    j.non_redundancy +
    j.actionability +
    j.fairness
  ) / 5;
}

export function parseStrengthWeaknessEvalFromOutputJson(
  parsed: unknown,
): StrengthWeaknessEvalSnapshot | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const sw = o.strengthWeaknessEval;
  if (!sw || typeof sw !== "object") return null;
  const r = sw as Record<string, unknown>;
  const nums = (k: string) =>
    typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : null;
  const s = nums("specificity");
  const e = nums("evidence_grounding");
  const n = nums("non_redundancy");
  const a = nums("actionability");
  const f = nums("fairness");
  if (s == null || e == null || n == null || a == null || f == null) return null;
  const flags = r.failure_flags;
  const failure_flags =
    Array.isArray(flags) ?
      flags.filter((x): x is string => typeof x === "string")
    : [];
  const notesRaw = r.notes;
  const notes = typeof notesRaw === "string" ? notesRaw : undefined;
  return {
    specificity: s,
    evidence_grounding: e,
    non_redundancy: n,
    actionability: a,
    fairness: f,
    failure_flags,
    notes,
  };
}
