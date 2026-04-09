"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSongAndInitialVersion } from "@/lib/songs/actions";

export function NewPieceButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createSongAndInitialVersion();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/song/${result.songId}`);
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onCreate}
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creating..." : "New piece"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
