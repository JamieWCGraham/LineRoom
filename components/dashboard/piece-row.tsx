"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteSong, updateSongTitle } from "@/lib/songs/actions";
import logoAsset from "@/lib/logos/logo.png";

export type PieceRowLayout = "expanded" | "compact" | "grid";

type Props = {
  songId: string;
  initialTitle: string;
  updatedAt: string;
  latestVersionNumber: number | null;
  overallRatingBand: string | null;
  momentumLabel: string | null;
  momentumTone: "up" | "down" | "flat" | null;
  genres: string[];
  /** Mobile list / grid vs desktop detailed row */
  rowLayout?: PieceRowLayout;
};

const btnSecondary =
  "shrink-0 rounded-md border border-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-40";

const btnPrimary =
  "shrink-0 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40";

const btnDanger =
  "shrink-0 rounded-md border border-rose-900/60 px-2.5 py-1 text-xs font-medium text-rose-200 hover:border-rose-700 hover:bg-rose-950/40 disabled:opacity-40";

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function overallBandClassName(band: string): string {
  if (band === "Needs Work") {
    return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  }
  if (band === "Promising") {
    return "border-sky-900/60 bg-sky-950/25 text-sky-200";
  }
  if (band === "Strong") {
    return "border-lime-800/70 bg-lime-950/25 text-lime-100";
  }
  if (band === "Standout") {
    return "border-emerald-900/70 bg-emerald-950/30 text-emerald-200";
  }
  return "border-zinc-700 text-zinc-300";
}

function PieceListLogoMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700/70 bg-gradient-to-br from-zinc-800 to-emerald-950/45 ${className ?? ""}`}
      aria-hidden
    >
      <Image
        src={logoAsset}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}

function OverflowMenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function PieceRow({
  songId,
  initialTitle,
  updatedAt,
  latestVersionNumber,
  overallRatingBand,
  momentumLabel,
  momentumTone,
  genres,
  rowLayout = "expanded",
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [titlePending, startTitleTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const busy = titlePending || deletePending;
  const compact = rowLayout === "compact" || rowLayout === "grid";

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    router.prefetch(`/song/${songId}`);
  }, [router, songId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const dirty = title.trim() !== initialTitle.trim();

  const beginEdit = () => {
    setMenuOpen(false);
    setError(null);
    setTitle(initialTitle);
    setEditing(true);
  };

  const cancelEdit = () => {
    setError(null);
    setTitle(initialTitle);
    setEditing(false);
  };

  const saveTitle = () => {
    setError(null);
    startTitleTransition(async () => {
      const result = await updateSongTitle(songId, title);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    setMenuOpen(false);
    if (
      !confirm(
        "Delete this piece and all saved versions? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteSong(songId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  const onOpenFromRow = (e: React.MouseEvent<HTMLElement>) => {
    if (editing) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, [data-piece-menu]")) return;
    router.push(`/song/${songId}`);
  };

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (editing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/song/${songId}`);
    }
  };

  const overflowMenu = !editing ? (
    <div className="relative shrink-0" ref={menuRef} data-piece-menu>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        disabled={busy}
        className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label={`More actions for ${initialTitle}`}
      >
        <OverflowMenuIcon />
      </button>
      {menuOpen ?
        <div
          className="absolute right-0 z-30 mt-1 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          role="menu"
        >
          <Link
            href={`/song/${songId}`}
            prefetch
            role="menuitem"
            className="block px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            onClick={() => setMenuOpen(false)}
          >
            Open
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
            onClick={beginEdit}
            disabled={busy}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-950/50"
            onClick={onDelete}
            disabled={busy}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
      : null}
    </div>
  ) : null;

  if (rowLayout === "grid") {
    return (
      <li className="relative list-none">
        {editing ?
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty && !titlePending) {
                  e.preventDefault();
                  saveTitle();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              maxLength={200}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
              autoFocus
              aria-label="Piece title"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={cancelEdit} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTitle}
                disabled={!dirty || busy}
                className={btnPrimary}
              >
                {titlePending ? "Saving…" : "Save"}
              </button>
            </div>
            {error ?
              <p className="mt-2 text-xs text-red-400" role="alert">
                {error}
              </p>
            : null}
          </div>
        : <div
            className="flex min-h-[148px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 active:bg-zinc-900"
            onClick={onOpenFromRow}
            onKeyDown={onRowKeyDown}
            role="link"
            tabIndex={0}
            aria-label={`Open ${initialTitle}`}
          >
            <div className="flex items-start justify-between gap-2">
              <PieceListLogoMark />
              {overflowMenu}
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
              {initialTitle}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {overallRatingBand ?
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${overallBandClassName(overallRatingBand)}`}
                >
                  {overallRatingBand}
                </span>
              : null}
              {typeof latestVersionNumber === "number" ?
                <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  v{latestVersionNumber}
                </span>
              : null}
            </div>
            <p className="mt-auto pt-2 text-xs text-zinc-500">{formatShortDate(updatedAt)}</p>
          </div>
        }
      </li>
    );
  }

  if (rowLayout === "compact") {
    return (
      <li
        className="border-b border-zinc-800/90 transition hover:bg-zinc-900/50"
        onClick={onOpenFromRow}
        onKeyDown={onRowKeyDown}
        role="link"
        tabIndex={editing ? -1 : 0}
        aria-label={`Open ${initialTitle}`}
      >
        {editing ?
          <div className="flex flex-col gap-2 px-3 py-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty && !titlePending) {
                  e.preventDefault();
                  saveTitle();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              maxLength={200}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
              autoFocus
              aria-label="Piece title"
            />
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTitle}
                disabled={!dirty || busy}
                className={btnPrimary}
              >
                {titlePending ? "Saving…" : "Save"}
              </button>
            </div>
            {error ?
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            : null}
          </div>
        : <div className="flex items-center gap-3 px-3 py-3 pr-1">
            <PieceListLogoMark />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-zinc-100">{initialTitle}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{formatShortDate(updatedAt)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {overallRatingBand ?
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${overallBandClassName(overallRatingBand)}`}
                  >
                    {overallRatingBand}
                  </span>
                : null}
                {typeof latestVersionNumber === "number" ?
                  <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                    v{latestVersionNumber}
                  </span>
                : null}
              </div>
            </div>
            {overflowMenu}
          </div>
        }
      </li>
    );
  }

  return (
    <li
      className="px-4 py-4 transition hover:bg-zinc-900/60 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      onClick={onOpenFromRow}
      onKeyDown={onRowKeyDown}
      role="link"
      tabIndex={editing ? -1 : 0}
      aria-label={`Open ${initialTitle}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ?
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty && !titlePending) {
                    e.preventDefault();
                    saveTitle();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                maxLength={200}
                className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-sm font-medium text-zinc-100 outline-none ring-zinc-500 placeholder:text-zinc-600 focus:ring-2"
                placeholder="Piece title"
                autoFocus
                aria-label="Piece title"
              />
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={busy}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTitle}
                  disabled={!dirty || busy}
                  className={btnPrimary}
                >
                  {titlePending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          : <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={`/song/${songId}`}
                prefetch
                className="truncate text-sm font-medium text-zinc-100 underline-offset-2 hover:text-white hover:underline"
              >
                {initialTitle}
              </Link>
              <p className="text-xs text-zinc-500">Updated {formatUpdatedAt(updatedAt)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {overallRatingBand ?
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${overallBandClassName(overallRatingBand)}`}
                  >
                    {overallRatingBand}
                  </span>
                : null}
                {latestVersionNumber ?
                  <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                    v{latestVersionNumber}
                  </span>
                : null}
                {momentumLabel ?
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${
                      momentumTone === "up"
                        ? "border-emerald-900/70 bg-emerald-950/30 text-emerald-200"
                        : momentumTone === "down"
                          ? "border-stone-700/80 bg-stone-950/40 text-stone-300"
                          : "border-zinc-700 text-zinc-300"
                    }`}
                  >
                    {momentumLabel}
                  </span>
                : null}
              </div>
              {genres.length > 0 ?
                <p className="mt-1 truncate text-[11px] text-zinc-500">
                  Genres: {genres.join(" · ")}
                </p>
              : null}
            </div>
          }
        </div>

        {!editing && !compact ?
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
            <button
              type="button"
              onClick={beginEdit}
              disabled={busy}
              className={btnSecondary}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className={btnDanger}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          </div>
        : null}
      </div>
      {error ?
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      : null}
    </li>
  );
}
