/** Minimum normalized (whitespace-stripped) draft length before registry lookup/register. */
export const MIN_NORMALIZED_DRAFT_LENGTH = 40;

export function isDraftCritiqueGateEnabled(): boolean {
  const raw = process.env.DRAFT_CRITIQUE_GATE_ENABLED;
  if (raw === undefined || raw === "") return true;
  const v = raw.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function isDraftGateFailOpen(): boolean {
  const raw = process.env.DRAFT_GATE_FAIL_OPEN;
  if (raw === undefined || raw === "") return true;
  const v = raw.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}
