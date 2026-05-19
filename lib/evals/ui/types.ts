import type {
  LineFeedbackDrilldownStatus,
  StrengthWeaknessDrilldownStatus,
} from "@/lib/evals/computeEvalRunMetrics";
import type { GroundTruthRowMetrics } from "@/lib/evals/computeEvalRunMetrics";

export type GroundTruthRow = GroundTruthRowMetrics;

export type GtSortKey =
  | "id"
  | "title"
  | "artist"
  | "overallScore"
  | "isCorrect"
  | "predictedOverallScore";

export type GtSortState = { key: GtSortKey; dir: "asc" | "desc" };

export type GtFilterState = {
  id: string;
  title: string;
  artist: string;
  overallScore: string;
  isCorrect: "all" | "true" | "false";
  predictedOverallScore: string;
};

export type SwDrillSortKey =
  | "id"
  | "title"
  | "swSpecificity"
  | "swEvidence"
  | "swNonRedundancy"
  | "swActionability"
  | "swFairness"
  | "swComposite"
  | "swFlagCount"
  | "swStatus";

export type SwDrillSortState = { key: SwDrillSortKey; dir: "asc" | "desc" };

export type SwDrillFilterState = {
  id: string;
  title: string;
  status: "all" | StrengthWeaknessDrilldownStatus;
  issuesOnly: boolean;
};

export type LfDrillSortKey =
  | "id"
  | "title"
  | "lfComposite"
  | "lfCoverage"
  | "lfStatus";

export type LfDrillSortState = { key: LfDrillSortKey; dir: "asc" | "desc" };

export type LfDrillFilterState = {
  id: string;
  title: string;
  status: "all" | LineFeedbackDrilldownStatus;
  issuesOnly: boolean;
};

export const GT_SORT_DEFAULT: GtSortState = {
  key: "overallScore",
  dir: "asc",
};

export const GT_FILTERS_EMPTY: GtFilterState = {
  id: "",
  title: "",
  artist: "",
  overallScore: "",
  isCorrect: "all",
  predictedOverallScore: "",
};

export const SW_DRILL_SORT_DEFAULT: SwDrillSortState = {
  key: "swComposite",
  dir: "asc",
};

export const SW_DRILL_FILTERS_EMPTY: SwDrillFilterState = {
  id: "",
  title: "",
  status: "all",
  issuesOnly: false,
};

export const LF_DRILL_SORT_DEFAULT: LfDrillSortState = {
  key: "lfComposite",
  dir: "asc",
};

export const LF_DRILL_FILTERS_EMPTY: LfDrillFilterState = {
  id: "",
  title: "",
  status: "all",
  issuesOnly: false,
};

export const SW_STATUS_OPTIONS: StrengthWeaknessDrilldownStatus[] = [
  "ok",
  "no_gold_reference",
  "no_judge_in_output",
  "missing_run_output",
  "missing_prediction",
  "invalid_gold_label",
];

export const LF_STATUS_OPTIONS: LineFeedbackDrilldownStatus[] = [
  "ok",
  "no_gold_reference",
  "no_judge_in_output",
  "missing_run_output",
  "missing_prediction",
  "invalid_gold_label",
];
