/**
 * Folder-safe unique id for an evaluation run (used as storage prefix).
 */
export function createEvalRunTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
