/**
 * Langfuse observation names for the linear critique graph.
 * One root trace (`lineroom-critique`); these are sequential child steps.
 */
export const critiqueEngineLangfuseSteps = {
  genreContext: "genre-context",
  calibrationScoring: "calibration-scoring",
  synthesis: "synthesis",
  lineFeedback: "line-level-feedback",
} as const;

/** Keys merged into `nodeTimingsMs` (milliseconds per step). */
export const critiqueEngineTimingKeys = {
  genreContext: "genre-context_ms",
  calibrationScoring: "calibration-scoring_ms",
  synthesis: "synthesis_ms",
  lineFeedback: "line-level-feedback_ms",
} as const;
