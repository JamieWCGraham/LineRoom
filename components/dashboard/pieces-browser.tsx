"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PieceRow } from "@/components/dashboard/piece-row";

type SongListItem = {
  id: string;
  title: string;
  updated_at: string;
  latestVersionNumber: number | null;
  overallRatingBand: string | null;
  momentumLabel: string | null;
  momentumTone: "up" | "down" | "flat" | null;
  genres: string[];
  latestDraftText: string | null;
};

type Props = {
  songs: SongListItem[];
};

type SortMode =
  | "updated_desc"
  | "updated_asc"
  | "title_asc"
  | "title_desc";
type FilterMode = "all" | "updated_7d" | "updated_30d" | "older";

const PAGE_SIZE = 6;

function safeTime(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function PiecesBrowser({ songs }: Props) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const indexedSongs = useMemo(
    () =>
      songs.map((song) => ({
        ...song,
        searchBlob: `${song.title}\n${song.latestDraftText ?? ""}`.toLowerCase(),
      })),
    [songs],
  );
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const filteredAndSortedSongs = useMemo(() => {
    let next = indexedSongs;

    if (normalizedQuery) {
      next = next.filter((song) => song.searchBlob.includes(normalizedQuery));
    }

    if (filterMode !== "all") {
      next = next.filter((song) => {
        const updated = safeTime(song.updated_at);
        if (filterMode === "updated_7d") return updated >= sevenDaysAgo;
        if (filterMode === "updated_30d") return updated >= thirtyDaysAgo;
        return updated < thirtyDaysAgo;
      });
    }

    return [...next].sort((a, b) => {
      if (sortMode === "updated_desc") {
        return safeTime(b.updated_at) - safeTime(a.updated_at);
      }
      if (sortMode === "updated_asc") {
        return safeTime(a.updated_at) - safeTime(b.updated_at);
      }
      if (sortMode === "title_asc") {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }
      return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    });
  }, [
    indexedSongs,
    normalizedQuery,
    filterMode,
    sortMode,
    sevenDaysAgo,
    thirtyDaysAgo,
  ]);

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, sortMode, filterMode]);

  const totalItems = filteredAndSortedSongs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shouldPaginate = totalItems > PAGE_SIZE;
  const pageStart = shouldPaginate ? (currentPage - 1) * PAGE_SIZE : 0;
  const pageEnd = shouldPaginate ? pageStart + PAGE_SIZE : totalItems;
  const songsForPage = filteredAndSortedSongs.slice(pageStart, pageEnd);

  const emptyMessage =
    songs.length === 0 ?
      "No pieces yet. Start with New piece to open a saved LineRoom."
    : "No pieces match your filters. Try a different search or filter.";
  const controlClassName =
    "h-10 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2";

  return (
    <div className="mt-4 space-y-4">
      {songs.length > 0 ?
        <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Search
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a lyric, phrase, or title..."
              className={`${controlClassName} py-0 placeholder:text-zinc-500`}
              aria-label="Search pieces by title"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Filter
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className={controlClassName}
              aria-label="Filter pieces by updated time"
            >
              <option value="all">All time</option>
              <option value="updated_7d">Updated in last 7 days</option>
              <option value="updated_30d">Updated in last 30 days</option>
              <option value="older">Older than 30 days</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={controlClassName}
              aria-label="Sort pieces"
            >
              <option value="updated_desc">Recently updated</option>
              <option value="updated_asc">Oldest updated</option>
              <option value="title_asc">Title A-Z</option>
              <option value="title_desc">Title Z-A</option>
            </select>
          </label>
        </div>
      : null}

      {songsForPage.length === 0 ?
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          {emptyMessage}
        </p>
      : <>
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {songsForPage.map((s) => (
              <PieceRow
                key={s.id}
                songId={s.id}
                initialTitle={s.title}
                updatedAt={s.updated_at}
                latestVersionNumber={s.latestVersionNumber}
                overallRatingBand={s.overallRatingBand}
                momentumLabel={s.momentumLabel}
                momentumTone={s.momentumTone}
                genres={s.genres}
              />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <p>
              Showing {songsForPage.length > 0 ? pageStart + 1 : 0}-
              {Math.min(pageEnd, totalItems)} of {totalItems}
            </p>

            {shouldPaginate ?
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            : <span>Pagination starts at 7+ pieces</span>}
          </div>
        </>
      }
    </div>
  );
}
