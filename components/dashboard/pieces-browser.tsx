"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardSectionHeading } from "@/components/dashboard/dashboard-section-heading";
import { DASHBOARD_TABLE_GRID } from "@/components/dashboard/dashboard-table";
import { NewPieceButton } from "@/components/dashboard/new-piece-button";
import { PieceRow, type PieceRowLayout } from "@/components/dashboard/piece-row";
import { useIsMdUp } from "@/lib/hooks/use-media-query";

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
  /** Enables Google-Docs-style mobile shell (search row, drawer, FAB). */
  mobileNav?: {
    email: string;
    showEvalsNav: boolean;
  };
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="flex h-5 w-5 flex-col justify-center gap-1" aria-hidden>
      <span
        className={`h-0.5 rounded-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
      />
      <span className={`h-0.5 rounded-full bg-current transition ${open ? "opacity-0" : ""}`} />
      <span
        className={`h-0.5 rounded-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
      />
    </span>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

export function PiecesBrowser({ songs, mobileNav }: Props) {
  const isMdUp = useIsMdUp();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileGrid, setMobileGrid] = useState(false);
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

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const totalItems = filteredAndSortedSongs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shouldPaginate = isMdUp && totalItems > PAGE_SIZE;
  const pageStart = shouldPaginate ? (currentPage - 1) * PAGE_SIZE : 0;
  const pageEnd = shouldPaginate ? pageStart + PAGE_SIZE : totalItems;
  const songsForPage = filteredAndSortedSongs.slice(pageStart, pageEnd);

  const emptyMessage =
    songs.length === 0 ?
      "No pieces yet. Start with New piece to open a saved LineRoom."
    : "No pieces match your filters. Try a different search or filter.";
  const controlClassName =
    "h-10 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2";

  const rowLayout: PieceRowLayout =
    isMdUp ? "expanded" : mobileGrid ? "grid" : "compact";

  const emailInitial =
    mobileNav?.email?.trim()?.charAt(0)?.toUpperCase() ?? "";

  return (
    <div className="md:space-y-4">
      <div className="mb-1 hidden md:block">
        <DashboardSectionHeading
          title="Your Pieces"
          action={<NewPieceButton />}
        />
      </div>

      {/* Mobile: sticky chrome */}
      <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-zinc-800/80 bg-zinc-950 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
        <div className="flex items-center gap-2 rounded-2xl bg-zinc-800/90 px-2 py-2 shadow-inner shadow-black/20">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-200 hover:bg-zinc-700/80"
            aria-label="Open menu"
          >
            <HamburgerIcon open={false} />
          </button>
          <span className="text-zinc-500" aria-hidden>
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in LineRoom"
            className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            aria-label="Search pieces"
          />
          {mobileNav?.showEvalsNav ?
            <Link
              href="/evals"
              prefetch
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-emerald-200/90 hover:bg-zinc-700/80"
              aria-label="Evals"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </Link>
          : null}
          <Link
            href="/account"
            prefetch
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800/80 text-sm font-semibold text-emerald-50 ring-1 ring-zinc-600 hover:bg-emerald-700/90"
            aria-label="Account"
          >
            {emailInitial || "·"}
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Sort pieces</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="w-full cursor-pointer appearance-none rounded-lg border-0 bg-transparent py-2 pl-0 pr-8 text-sm font-medium text-zinc-200 focus:outline-none focus:ring-0"
            >
              <option value="updated_desc">Last updated</option>
              <option value="updated_asc">Oldest updated</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden>
              ▾
            </span>
          </label>
          <button
            type="button"
            onClick={() => setMobileGrid((g) => !g)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
              mobileGrid
                ? "border-blue-500/50 bg-blue-950/40 text-blue-200"
                : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            aria-pressed={mobileGrid}
            aria-label={mobileGrid ? "List view" : "Grid view"}
          >
            {mobileGrid ? <ListIcon /> : <GridIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ?
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,280px)] flex-col border-r border-zinc-800 bg-zinc-950 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-100">LineRoom</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-900"
                aria-label="Close"
              >
                <HamburgerIcon open />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {mobileNav?.email ?
                <p className="text-xs text-zinc-500">
                  Signed in as{" "}
                  <span className="font-medium text-zinc-300">{mobileNav.email}</span>
                </p>
              : null}
              <nav className="flex flex-col gap-1">
                <Link
                  href="/account"
                  prefetch
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-100 hover:bg-zinc-900"
                >
                  Account
                </Link>
                {mobileNav?.showEvalsNav ?
                  <Link
                    href="/evals"
                    prefetch
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm text-emerald-100 hover:bg-emerald-950/30"
                  >
                    Evals
                  </Link>
                : null}
              </nav>
              <div className="border-t border-zinc-800 pt-4">
                <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                  Filter by update
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                    className={controlClassName}
                  >
                    <option value="all">All time</option>
                    <option value="updated_7d">Last 7 days</option>
                    <option value="updated_30d">Last 30 days</option>
                    <option value="older">Older than 30 days</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="border-t border-zinc-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <SignOutButton />
            </div>
          </div>
        </div>
      : null}

      {/* Desktop toolbar */}
      {songs.length > 0 ?
        <div className="hidden gap-3 md:grid md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
            <span className="sr-only">Search</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lyrics, phrases, or titles..."
                className={`${controlClassName} w-full py-0 pl-9 placeholder:text-zinc-500`}
                aria-label="Search pieces"
              />
            </div>
          </label>

          <label className="flex w-36 flex-col gap-1 text-xs text-zinc-500">
            Filter
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className={controlClassName}
              aria-label="Filter pieces by updated time"
            >
              <option value="all">All time</option>
              <option value="updated_7d">Last 7 days</option>
              <option value="updated_30d">Last 30 days</option>
              <option value="older">Older than 30 days</option>
            </select>
          </label>

          <label className="flex w-44 flex-col gap-1 text-xs text-zinc-500">
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
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500 md:rounded-lg">
          {emptyMessage}
        </p>
      : <>
          <div
            className={
              isMdUp ? "hidden rounded-lg border border-zinc-800 md:block" : "hidden"
            }
          >
            <div
              className={`${DASHBOARD_TABLE_GRID} border-b border-zinc-800 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500`}
              role="row"
            >
              <span role="columnheader">Title</span>
              <span role="columnheader" className="flex items-center gap-1">
                Updated
                {sortMode === "updated_desc" ?
                  <span className="text-zinc-400" aria-hidden>
                    ↓
                  </span>
                : null}
              </span>
              <span role="columnheader">Tags</span>
              <span role="columnheader">Genre</span>
              <span role="columnheader" className="text-right">
                Actions
              </span>
            </div>
            <ul className="divide-y divide-zinc-800">
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
                  rowLayout={rowLayout}
                />
              ))}
            </ul>
          </div>
          <ul
            className={
              isMdUp ?
                "hidden"
              : mobileGrid ?
                "grid list-none grid-cols-2 gap-3 px-0 pb-28 pt-1"
              : "list-none pb-28 pt-0"
            }
          >
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
                rowLayout={rowLayout}
              />
            ))}
          </ul>

          <div className="hidden flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 md:flex">
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

      <NewPieceButton variant="fab" />
    </div>
  );
}
