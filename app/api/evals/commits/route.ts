import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { getGithubRepository, getGithubToken } from "@/lib/github/commitsConfig";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(100),
  /** Omit to use the repo default branch from GitHub (recommended). */
  sha: z.string().min(1).max(256).optional(),
});

type GithubCommitItem = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string | null; email: string | null; date: string | null } | null;
    committer: { name: string | null; email: string | null; date: string | null } | null;
  };
};

type RepoMeta = {
  full_name: string;
  default_branch: string;
};

function summarizeMessage(message: string): { subject: string; bodyPreview: string | null } {
  const normalized = message.replace(/\r\n/g, "\n").trimEnd();
  const idx = normalized.indexOf("\n");
  if (idx === -1) {
    return { subject: normalized || "(no message)", bodyPreview: null };
  }
  const subject = normalized.slice(0, idx).trim() || "(no subject)";
  let body = normalized.slice(idx + 1).trim();
  if (!body) return { subject, bodyPreview: null };
  const max = 360;
  if (body.length > max) body = `${body.slice(0, max)}…`;
  return { subject, bodyPreview: body };
}

function buildHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LineRoom-Evals-Commits/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function repoAccessHint(
  status: number,
  hasToken: boolean,
  requestedRepo: string,
): string | undefined {
  if (status === 401) {
    return "GitHub rejected the token (401). Regenerate GITHUB_TOKEN and ensure it is not expired; restart `npm run dev` after changing .env.local.";
  }
  if (status === 403) {
    return "GitHub returned 403. For org repos, open the token on GitHub → SSO → Authorize. Fine-grained PATs also need Metadata + Contents (read) on this repository.";
  }
  if (status === 404) {
    if (!hasToken) {
      return "Private or missing repos return 404 without auth. Add GITHUB_TOKEN to .env.local (classic: repo scope; fine-grained: pick this repo + Contents read + Metadata read) and restart the dev server.";
    }
    return [
      `Could not read ${requestedRepo} with your token.`,
      "Fine-grained: edit the PAT → Repository access → include this repo (only explicitly listed repos are visible).",
      "Organization: Settings → Personal access tokens → SSO → Authorize for the org.",
      "Confirm GITHUB_REPOSITORY matches GitHub exactly (e.g. JamieWCGraham/LineRoom).",
    ].join(" ");
  }
  return undefined;
}

export async function GET(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    perPage: url.searchParams.get("perPage") ?? undefined,
    sha: url.searchParams.get("sha") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  const envRepo = getGithubRepository();
  const token = getGithubToken();
  const headers = buildHeaders(token);
  const { page, perPage, sha: shaParam } = parsed.data;

  const metaUrl = `https://api.github.com/repos/${envRepo.owner}/${envRepo.repo}`;
  let metaRes: Response;
  try {
    metaRes = await fetch(metaUrl, { headers, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: "GitHub request failed", detail: msg }, { status: 502 });
  }

  if (!metaRes.ok) {
    let detail: string | undefined;
    try {
      const j = (await metaRes.json()) as { message?: string };
      detail = j.message;
    } catch {
      detail = await metaRes.text();
    }
    const hint = repoAccessHint(metaRes.status, Boolean(token), envRepo.fullName);
    const status = metaRes.status === 404 || metaRes.status === 403 ? metaRes.status : 502;
    return NextResponse.json(
      {
        error: "GitHub API error (repository)",
        status: metaRes.status,
        detail: detail ?? metaRes.statusText,
        repository: envRepo.fullName,
        hint,
      },
      { status },
    );
  }

  let meta: RepoMeta;
  try {
    meta = (await metaRes.json()) as RepoMeta;
  } catch {
    return NextResponse.json({ error: "Invalid JSON from GitHub (repo)" }, { status: 502 });
  }

  const fullName = meta.full_name ?? envRepo.fullName;
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "Unexpected repo full_name from GitHub" }, { status: 502 });
  }

  const resolvedSha = shaParam ?? meta.default_branch ?? "main";

  const ghUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  ghUrl.searchParams.set("sha", resolvedSha);
  ghUrl.searchParams.set("per_page", String(perPage));
  ghUrl.searchParams.set("page", String(page));

  let ghRes: Response;
  try {
    ghRes = await fetch(ghUrl.toString(), { headers, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: "GitHub request failed", detail: msg }, { status: 502 });
  }

  if (!ghRes.ok) {
    let detail: string | undefined;
    try {
      const j = (await ghRes.json()) as { message?: string };
      detail = j.message;
    } catch {
      detail = await ghRes.text();
    }
    const hint =
      ghRes.status === 404 ?
        `No commits for ref "${resolvedSha}". Try another branch or open the repo on GitHub and confirm the default branch name.`
      : undefined;
    return NextResponse.json(
      {
        error: "GitHub API error (commits)",
        status: ghRes.status,
        detail: detail ?? ghRes.statusText,
        repository: fullName,
        branch: resolvedSha,
        hint,
      },
      { status: ghRes.status === 404 ? 404 : 502 },
    );
  }

  const link = ghRes.headers.get("link");
  const hasNextPage = Boolean(link?.includes('rel="next"'));

  let raw: unknown;
  try {
    raw = await ghRes.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON from GitHub" }, { status: 502 });
  }

  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Unexpected GitHub response" }, { status: 502 });
  }

  const commits = (raw as GithubCommitItem[]).map((item) => {
    const message = item.commit?.message ?? "";
    const { subject, bodyPreview } = summarizeMessage(message);
    const author = item.commit?.author;
    const committer = item.commit?.committer;
    const displayName = author?.name ?? committer?.name ?? "unknown";
    const displayEmail = author?.email ?? committer?.email ?? "";
    const date = author?.date ?? committer?.date ?? null;
    const firstLine = message.split(/\r?\n/)[0] ?? "";
    const isMerge =
      firstLine.startsWith("Merge ") || /^Merge pull request #/i.test(firstLine);

    return {
      sha: item.sha.slice(0, 7),
      shaFull: item.sha,
      htmlUrl: item.html_url,
      subject,
      bodyPreview,
      authorName: displayName,
      authorEmail: displayEmail,
      date,
      isMerge,
    };
  });

  return NextResponse.json({
    repository: fullName,
    branch: resolvedSha,
    page,
    perPage,
    hasNextPage,
    commits,
  });
}
