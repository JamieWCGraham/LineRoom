/** Default matches this app’s canonical GitHub remote when unset. Override with GITHUB_REPOSITORY. */
const DEFAULT_REPO = "JamieWCGraham/LineRoom";

export function getGithubRepository(): { owner: string; repo: string; fullName: string } {
  const raw = (process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO).trim();
  const parts = raw.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return splitDefault(DEFAULT_REPO);
  }
  const [owner, repo] = parts;
  if (!owner || !repo) return splitDefault(DEFAULT_REPO);
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function splitDefault(full: string): { owner: string; repo: string; fullName: string } {
  const [owner, repo] = full.split("/");
  const o = owner ?? "JamieWCGraham";
  const r = repo ?? "LineRoom";
  return { owner: o, repo: r, fullName: `${o}/${r}` };
}

export function getGithubToken(): string | undefined {
  const t = process.env.GITHUB_TOKEN?.trim();
  return t || undefined;
}

/** Case-insensitive `owner/repo` match (for validating client-supplied repository). */
export function canonicalRepositoryMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(a) === norm(b);
}
