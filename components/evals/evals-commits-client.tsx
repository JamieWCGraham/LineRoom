"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CommitRow = {
  sha: string;
  shaFull: string;
  htmlUrl: string;
  subject: string;
  bodyPreview: string | null;
  authorName: string;
  authorEmail: string;
  date: string | null;
  isMerge: boolean;
};

type ApiOk = {
  repository: string;
  branch: string;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  commits: CommitRow[];
};

const SUMMARY_SHA_CHUNK = 50;

function shaKey(sha: string): string {
  return sha.trim().toLowerCase();
}

export function EvalsCommitsClient() {
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [repository, setRepository] = useState<string>("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [hideMerge, setHideMerge] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizeBusy, setSummarizeBusy] = useState<Record<string, boolean>>({});
  /** Per-commit optional questions sent with Summarize / Regenerate. */
  const [commitQuestions, setCommitQuestions] = useState<Record<string, string>>({});

  /** Resolved ref for pagination (avoids stale closure vs. `branch` in `useCallback`). */
  const branchRef = useRef("");

  const loadPage = useCallback(async (page: number, append: boolean) => {
    const qs = new URLSearchParams({
      page: String(page),
      perPage: "100",
    });
    if (branchRef.current) qs.set("sha", branchRef.current);
    const res = await fetch(`/api/evals/commits?${qs.toString()}`);
    const data = (await res.json()) as ApiOk & {
      error?: string;
      detail?: string;
      hint?: string;
      repository?: string;
    };
    if (!res.ok) {
      const parts = [
        data.repository ? `repo: ${data.repository}` : null,
        data.detail ?? data.error ?? `HTTP ${res.status}`,
        data.hint,
      ].filter(Boolean);
      throw new Error(parts.join(" — "));
    }
    setRepository(data.repository);
    branchRef.current = data.branch;
    setBranch(data.branch);
    setHasNextPage(data.hasNextPage);
    setNextPage(page + 1);
    setCommits((prev) => (append ? [...prev, ...data.commits] : data.commits));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPage(1, false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load commits.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  useEffect(() => {
    if (!repository || commits.length === 0) return;
    let cancelled = false;
    const uniqueShas = [...new Set(commits.map((c) => shaKey(c.shaFull)))];
    (async () => {
      const merged: Record<string, string> = {};
      try {
        for (let i = 0; i < uniqueShas.length; i += SUMMARY_SHA_CHUNK) {
          const chunk = uniqueShas.slice(i, i + SUMMARY_SHA_CHUNK);
          const qs = new URLSearchParams({
            repository,
            shas: chunk.join(","),
          });
          const res = await fetch(`/api/evals/commits/summaries?${qs.toString()}`);
          const data = (await res.json()) as {
            summaries?: Record<string, string>;
            error?: string;
          };
          if (!res.ok) continue;
          Object.assign(merged, data.summaries ?? {});
        }
        if (!cancelled) {
          setSummaries((prev) => ({ ...prev, ...merged }));
        }
      } catch {
        /* ignore batch hydrate failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, commits]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const c of commits) {
      if (c.authorName) set.add(c.authorName);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [commits]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commits.filter((c) => {
      if (hideMerge && c.isMerge) return false;
      if (authorFilter && c.authorName !== authorFilter) return false;
      if (!q) return true;
      const blob = [
        c.sha,
        c.shaFull,
        c.subject,
        c.bodyPreview ?? "",
        c.authorName,
        c.authorEmail,
        c.date ?? "",
        summaries[shaKey(c.shaFull)] ?? "",
        commitQuestions[shaKey(c.shaFull)] ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [commits, search, authorFilter, hideMerge, summaries, commitQuestions]);

  const summarizeOne = async (c: CommitRow, regenerate: boolean) => {
    if (!repository) return;
    const key = shaKey(c.shaFull);
    setSummarizeBusy((b) => ({ ...b, [key]: true }));
    setError(null);
    const qRaw = (commitQuestions[key] ?? "").trim();
    try {
      const payload: Record<string, unknown> = {
        repository,
        commitSha: key,
        regenerate,
      };
      if (qRaw.length > 0) payload.userQuestions = qRaw;
      const res = await fetch("/api/evals/commits/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        summary?: string;
        commitSha?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
      }
      if (typeof data.summary === "string" && typeof data.commitSha === "string") {
        const normalizedSha = shaKey(data.commitSha);
        const summary = data.summary;
        setSummaries((prev) => ({ ...prev, [normalizedSha]: summary }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary failed.");
    } finally {
      setSummarizeBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const loadMore = async () => {
    setLoadMoreBusy(true);
    setError(null);
    try {
      await loadPage(nextPage, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more.");
    } finally {
      setLoadMoreBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SHA, message, author, date…"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Author
          </span>
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">All</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={hideMerge}
            onChange={(e) => setHideMerge(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-950"
          />
          Hide merge commits
        </label>
      </div>

      {repository ?
        <p className="text-sm text-zinc-500">
          Showing <span className="text-zinc-300">{filtered.length}</span>
          {" of "}
          <span className="text-zinc-300">{commits.length}</span> loaded commits on{" "}
          <span className="font-mono text-zinc-300">{branch}</span> —{" "}
          <a
            href={`https://github.com/${repository}/commits/${branch}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-500/90 hover:text-amber-400"
          >
            {repository}
          </a>
        </p>
      : null}

      {error ?
        <p className="text-sm text-red-400">{error}</p>
      : null}

      {loading ?
        <p className="text-sm text-zinc-500">Loading commits…</p>
      : null}

      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40">
        <ul className="divide-y divide-zinc-800/80">
          {filtered.map((c) => (
            <li key={c.shaFull} className="px-4 py-3 hover:bg-zinc-900/50">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <a
                  href={c.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-amber-500/90 hover:text-amber-400"
                >
                  {c.sha}
                </a>
                {c.isMerge ?
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    merge
                  </span>
                : null}
                <span className="text-sm font-medium text-zinc-100">{c.subject}</span>
              </div>
              {c.bodyPreview ?
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
                  {c.bodyPreview}
                </p>
              : null}
              <p className="mt-2 text-xs text-zinc-600">
                {c.authorName}
                {c.authorEmail ? ` <${c.authorEmail}>` : ""}
                {c.date ?
                  <>
                    {" · "}
                    {new Date(c.date).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </>
                : null}
              </p>
              <div className="mt-3 space-y-3 border-t border-zinc-800/60 pt-3">
                <label className="block w-full">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Questions about this commit (optional)
                  </span>
                  <textarea
                    rows={2}
                    value={commitQuestions[shaKey(c.shaFull)] ?? ""}
                    onChange={(e) => {
                      const k = shaKey(c.shaFull);
                      setCommitQuestions((prev) => ({ ...prev, [k]: e.target.value }));
                    }}
                    disabled={Boolean(summarizeBusy[shaKey(c.shaFull)])}
                    placeholder="Ask anything specific (e.g. risk to billing, why a file was removed, migration steps). Used only when you Summarize or Regenerate."
                    className="mt-1 min-h-[2.75rem] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
                  />
                </label>
                <div className="flex flex-wrap items-start gap-3">
                  {summaries[shaKey(c.shaFull)] ?
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-zinc-300">
                      {summaries[shaKey(c.shaFull)]}
                    </p>
                  : (
                    <p className="flex-1 text-xs text-zinc-600">
                      No summary yet — fetches the diff from GitHub, runs the gateway model once, then
                      saves it for next time.
                    </p>
                  )}
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                    {!summaries[shaKey(c.shaFull)] ?
                      <button
                        type="button"
                        onClick={() => void summarizeOne(c, false)}
                        disabled={Boolean(summarizeBusy[shaKey(c.shaFull)]) || !repository}
                        className="rounded-lg border border-violet-800/60 bg-violet-950/35 px-3 py-1.5 text-xs font-medium text-violet-100 hover:border-violet-600/50 hover:bg-violet-950/50 disabled:opacity-50"
                      >
                        {summarizeBusy[shaKey(c.shaFull)] ? "Summarizing…" : "Summarize"}
                      </button>
                    : (
                      <button
                        type="button"
                        onClick={() => void summarizeOne(c, true)}
                        disabled={Boolean(summarizeBusy[shaKey(c.shaFull)]) || !repository}
                        className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/60 disabled:opacity-50"
                      >
                        {summarizeBusy[shaKey(c.shaFull)] ? "Regenerating…" : "Regenerate"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {!loading && filtered.length === 0 ?
          <p className="p-6 text-sm text-zinc-500">No commits match the current filters.</p>
        : null}
      </div>

      {hasNextPage ?
        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadMoreBusy}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            {loadMoreBusy ? "Loading…" : "Load more from GitHub"}
          </button>
        </div>
      : null}
    </div>
  );
}
