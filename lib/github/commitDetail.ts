import { getGithubToken } from "@/lib/github/commitsConfig";

export type GithubCommitFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type GithubCommitDetail = {
  sha: string;
  commit: { message: string };
  html_url: string;
  files?: GithubCommitFile[];
  stats?: { total?: number; additions?: number; deletions?: number };
};

function githubHeaders(): Record<string, string> {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LineRoom-Evals-Commits/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchGithubCommitDetail(
  owner: string,
  repo: string,
  commitSha: string,
): Promise<{ ok: true; data: GithubCommitDetail } | { ok: false; status: number; message: string }> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(commitSha)}`;
  const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, message };
  }
  const data = (await res.json()) as GithubCommitDetail;
  return { ok: true, data };
}

export function buildCommitSummaryContext(detail: GithubCommitDetail): string {
  const msg = detail.commit?.message ?? "";
  const stats = detail.stats;
  const files = detail.files ?? [];
  const maxFiles = 28;
  const maxPatchPerFile = 2200;

  let out = `Repository commit ${detail.sha}\n\nMessage:\n${msg}\n`;
  if (stats) {
    out += `\nStats: +${stats.additions ?? 0} -${stats.deletions ?? 0} across ${stats.total ?? files.length} files\n`;
  }
  out += "\nChanged files (with truncated patches where present):\n";

  for (const f of files.slice(0, maxFiles)) {
    const patch = f.patch
      ? f.patch.length > maxPatchPerFile
        ? `${f.patch.slice(0, maxPatchPerFile)}\n… [patch truncated]`
        : f.patch
      : "(no text diff — binary or rename-only)";
    out += `\n--- ${f.filename} [${f.status}] +${f.additions}-${f.deletions}\n${patch}\n`;
  }
  if (files.length > maxFiles) {
    out += `\n… and ${files.length - maxFiles} more files (names omitted for length).\n`;
  }
  return out;
}
