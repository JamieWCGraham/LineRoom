"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteSong, updateSongTitle } from "@/lib/songs/actions";

type Props = {
  songId: string;
  initialTitle: string;
  updatedAt: string;
  latestVersionNumber: number | null;
  overallRatingBand: string | null;
  momentumLabel: string | null;
  momentumTone: "up" | "down" | "flat" | null;
  genres: string[];
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

export function PieceRow({
  songId,
  initialTitle,
  updatedAt,
  latestVersionNumber,
  overallRatingBand,
  momentumLabel,
  momentumTone,
  genres,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [titlePending, startTitleTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const busy = titlePending || deletePending;

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    router.prefetch(`/song/${songId}`);
  }, [router, songId]);

  const dirty = title.trim() !== initialTitle.trim();

  const beginEdit = () => {
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
    if (target?.closest("button, a, input, select, textarea")) return;
    router.push(`/song/${songId}`);
  };

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (editing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/song/${songId}`);
    }
  };

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
              <p className="text-xs text-zinc-500">
                Updated {formatUpdatedAt(updatedAt)}
              </p>
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
                          ? "border-amber-900/70 bg-amber-950/30 text-amber-200"
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

        {!editing ?
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
