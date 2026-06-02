/** Default when `EVALS_ACCESS_EMAILS` is unset (internal evals UI + APIs only). */
const DEFAULT_EVALS_ACCESS_EMAILS = ["jgraham0@msn.com"];

export function getEvalsAccessEmails(): Set<string> {
  const raw = process.env.EVALS_ACCESS_EMAILS;
  if (raw === undefined || raw.trim() === "") {
    return new Set(DEFAULT_EVALS_ACCESS_EMAILS);
  }
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

export function hasEvalsAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEvalsAccessEmails().has(email.trim().toLowerCase());
}
