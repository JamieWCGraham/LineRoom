import { CANONICAL_RATING_BANDS } from "@/lib/evals/ratingBands";
import { strengthWeaknessJudgeComposite } from "@/lib/evals/strengthWeaknessMetrics";
import type {
  GtFilterState,
  GtSortKey,
  GroundTruthRow,
  LfDrillFilterState,
  LfDrillSortKey,
  SwDrillFilterState,
  SwDrillSortKey,
} from "./types";
import type { LineFeedbackDrilldownStatus, StrengthWeaknessDrilldownStatus } from "@/lib/evals/computeEvalRunMetrics";

const BAND_ORDER = new Map(
  CANONICAL_RATING_BANDS.map((band, index) => [band, index] as const),
);

/** Lower = earlier in ascending “quality” order (Needs Work → Standout). */
export function bandSortRank(score: string | null | undefined): number {
  if (score == null || !String(score).trim()) {
    return CANONICAL_RATING_BANDS.length + 1;
  }
  const t = String(score).trim();
  const i = BAND_ORDER.get(t as (typeof CANONICAL_RATING_BANDS)[number]);
  if (i !== undefined) return i;
  return CANONICAL_RATING_BANDS.length;
}

export function compareGroundTruthRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: GtSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "artist":
      cmp = (a.artist || "").localeCompare(b.artist || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "overallScore": {
      const ra = bandSortRank(a.overallScore);
      const rb = bandSortRank(b.overallScore);
      cmp =
        ra !== rb ? ra - rb : (a.overallScore || "").localeCompare(b.overallScore || "");
      break;
    }
    case "isCorrect":
      cmp = Number(a.isCorrect) - Number(b.isCorrect);
      break;
    case "predictedOverallScore": {
      const ra = bandSortRank(a.predictedOverallScore);
      const rb = bandSortRank(b.predictedOverallScore);
      cmp =
        ra !== rb ?
          ra - rb
        : (a.predictedOverallScore || "").localeCompare(
            b.predictedOverallScore || "",
          );
      break;
    }
    default:
      cmp = 0;
  }
  return sign * cmp;
}

export function filterGroundTruthRows(
  rows: GroundTruthRow[],
  f: GtFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  const artistNeedle = f.artist.trim().toLowerCase();
  const scoreNeedle = f.overallScore.trim().toLowerCase();
  const predNeedle = f.predictedOverallScore.trim().toLowerCase();
  return rows.filter((r) => {
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (artistNeedle && !(r.artist || "").toLowerCase().includes(artistNeedle)) {
      return false;
    }
    if (
      scoreNeedle &&
      !(r.overallScore || "").toLowerCase().includes(scoreNeedle)
    ) {
      return false;
    }
    if (
      predNeedle &&
      !(r.predictedOverallScore || "").toLowerCase().includes(predNeedle)
    ) {
      return false;
    }
    if (f.isCorrect !== "all") {
      const want = f.isCorrect === "true";
      if (r.isCorrect !== want) return false;
    }
    return true;
  });
}

export function swStatusLabel(s: StrengthWeaknessDrilldownStatus): string {
  switch (s) {
    case "ok":
      return "Judge OK";
    case "no_gold_reference":
      return "No HITL SW";
    case "no_judge_in_output":
      return "No judge block";
    case "missing_run_output":
      return "Missing output";
    case "missing_prediction":
      return "Bad output";
    case "invalid_gold_label":
      return "Invalid gold band";
    default:
      return s;
  }
}

function cmpJudgeDim(
  a: GroundTruthRow["strengthWeaknessDrilldown"]["judge"],
  b: GroundTruthRow["strengthWeaknessDrilldown"]["judge"],
  dim:
    | "specificity"
    | "evidence_grounding"
    | "non_redundancy"
    | "actionability"
    | "fairness",
): number {
  const va = a?.[dim];
  const vb = b?.[dim];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return va - vb;
}

export function filterSwDrillRows(
  rows: GroundTruthRow[],
  f: SwDrillFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  return rows.filter((r) => {
    const sw = r.strengthWeaknessDrilldown;
    if (!sw) return false;
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (f.status !== "all" && sw.status !== f.status) return false;
    if (f.issuesOnly) {
      const composite = strengthWeaknessJudgeComposite(sw.judge);
      const flags = sw.judge?.failure_flags?.length ?? 0;
      const lowComposite = composite != null && composite < 3.5;
      const missingJudgeWithGold =
        sw.status === "no_judge_in_output" &&
        (sw.goldStrengths.length > 0 || sw.goldWeaknesses.length > 0);
      if (!lowComposite && flags === 0 && !missingJudgeWithGold) return false;
    }
    return true;
  });
}

export function compareSwDrillRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: SwDrillSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  const swA = a.strengthWeaknessDrilldown;
  const swB = b.strengthWeaknessDrilldown;
  if (!swA || !swB) return 0;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "swSpecificity":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "specificity");
      break;
    case "swEvidence":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "evidence_grounding");
      break;
    case "swNonRedundancy":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "non_redundancy");
      break;
    case "swActionability":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "actionability");
      break;
    case "swFairness":
      cmp = cmpJudgeDim(swA.judge, swB.judge, "fairness");
      break;
    case "swComposite": {
      const ca = strengthWeaknessJudgeComposite(swA.judge);
      const cb = strengthWeaknessJudgeComposite(swB.judge);
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "swFlagCount": {
      const fa = swA.judge?.failure_flags?.length ?? 0;
      const fb = swB.judge?.failure_flags?.length ?? 0;
      cmp = fa - fb;
      break;
    }
    case "swStatus":
      cmp = swA.status.localeCompare(swB.status);
      break;
    default:
      cmp = 0;
  }
  return sign * cmp;
}

export function lfStatusLabel(s: LineFeedbackDrilldownStatus): string {
  switch (s) {
    case "ok":
      return "Judge OK";
    case "no_gold_reference":
      return "No HITL line ref";
    case "no_judge_in_output":
      return "No judge block";
    case "missing_run_output":
      return "Missing output";
    case "missing_prediction":
      return "Bad output";
    case "invalid_gold_label":
      return "Invalid gold band";
    default:
      return s;
  }
}

export function filterLfDrillRows(
  rows: GroundTruthRow[],
  f: LfDrillFilterState,
): GroundTruthRow[] {
  const idSub = f.id.trim();
  const titleNeedle = f.title.trim().toLowerCase();
  return rows.filter((r) => {
    const lf = r.lineFeedbackDrilldown;
    if (!lf) return false;
    if (idSub && !String(r.id).includes(idSub)) return false;
    if (titleNeedle && !(r.title || "").toLowerCase().includes(titleNeedle)) {
      return false;
    }
    if (f.status !== "all" && lf.status !== f.status) return false;
    if (f.issuesOnly) {
      const comp = lf.judge?.line_level_composite;
      const flags = lf.judge?.failure_flags?.length ?? 0;
      const lowComposite = comp != null && comp < 0.45;
      const missingJudgeWithGold =
        lf.status === "no_judge_in_output" &&
        (lf.goldMustLines.length > 0 || lf.goldOptionalLines.length > 0);
      if (!lowComposite && flags === 0 && !missingJudgeWithGold) return false;
    }
    return true;
  });
}

export function compareLfDrillRows(
  a: GroundTruthRow,
  b: GroundTruthRow,
  key: LfDrillSortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  const lfA = a.lineFeedbackDrilldown;
  const lfB = b.lineFeedbackDrilldown;
  if (!lfA || !lfB) return 0;
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id - b.id;
      break;
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "lfComposite": {
      const ca = lfA.judge?.line_level_composite;
      const cb = lfB.judge?.line_level_composite;
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "lfCoverage": {
      const ca = lfA.judge?.coverage;
      const cb = lfB.judge?.coverage;
      if (ca == null && cb == null) cmp = 0;
      else if (ca == null) cmp = 1;
      else if (cb == null) cmp = -1;
      else cmp = ca - cb;
      break;
    }
    case "lfStatus":
      cmp = lfA.status.localeCompare(lfB.status);
      break;
    default:
      cmp = 0;
  }
  return sign * cmp;
}
