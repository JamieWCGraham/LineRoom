/** Max concurrent LLM calls per eval batch (default 8, max 32). */
export function getEvalBatchConcurrency(): number {
  const raw = process.env.LINE_ROOM_EVAL_BATCH_CONCURRENCY;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(32, Math.floor(n));
}

/** Max concurrent storage downloads when computing eval metrics (default 16, max 48). */
export function getEvalMetricsConcurrency(): number {
  const raw = process.env.LINE_ROOM_EVAL_METRICS_CONCURRENCY;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return 16;
  return Math.min(48, Math.floor(n));
}
