"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSongAndInitialVersion } from "@/lib/songs/actions";

type Variant = "default" | "fab";

export function NewPieceButton({ variant = "default" }: { variant?: Variant }) {
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

  if (variant === "fab") {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-5xl justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,calc(0.5rem+env(safe-area-inset-right)))]">
          <div className="flex flex-col items-end gap-2">
            {error ?
              <p className="max-w-[min(280px,calc(100vw-2rem))] rounded-lg border border-red-900/50 bg-red-950/90 px-3 py-2 text-xs text-red-200 shadow-lg">
                {error}
              </p>
            : null}
            <button
              type="button"
              onClick={onCreate}
              disabled={pending}
              aria-label={pending ? "Creating piece" : "New piece"}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-2xl font-light leading-none text-zinc-100 shadow-lg shadow-black/40 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ?
                <span className="block h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              : <span className="bg-gradient-to-br from-blue-400 via-emerald-400 to-teal-400 bg-clip-text text-3xl font-light text-transparent">
                  +
                </span>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onCreate}
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creating..." : "+ New piece"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
