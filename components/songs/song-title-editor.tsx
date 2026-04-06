"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateSongTitle } from "@/lib/songs/actions";

type Props = {
  songId: string;
  initialTitle: string;
  /** Called after a successful save with the normalized title (before refresh). */
  onTitleSaved?: (title: string) => void;
};

export function SongTitleEditor({
  songId,
  initialTitle,
  onTitleSaved,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

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

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateSongTitle(songId, title);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const normalized = title.trim() ? title.trim().slice(0, 200) : "Untitled piece";
      onTitleSaved?.(normalized);
      setEditing(false);
      router.refresh();
    });
  };

  const inputClass =
    "min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-sm font-medium text-zinc-100 outline-none ring-zinc-500 placeholder:text-zinc-600 focus:ring-2";

  const btnSecondary =
    "shrink-0 rounded-md border border-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-40";

  const btnPrimary =
    "shrink-0 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40";

  if (!editing) {
    return (
      <div className="flex min-w-0 max-w-xl flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-zinc-100">
            {initialTitle}
          </p>
          <button
            type="button"
            onClick={beginEdit}
            className={btnSecondary}
          >
            Edit title
          </button>
        </div>
        {error ?
          <p className="text-xs text-red-400">{error}</p>
        : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-xl flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`song-title-${songId}`}>
          Piece title
        </label>
        <input
          id={`song-title-${songId}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty && !pending) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          maxLength={200}
          className={inputClass}
          placeholder="Piece title"
          autoFocus
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className={btnSecondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className={btnPrimary}
          >
            {pending ? "Saving…" : "Save title"}
          </button>
        </div>
      </div>
      {error ?
        <p className="text-xs text-red-400">{error}</p>
      : null}
    </div>
  );
}
