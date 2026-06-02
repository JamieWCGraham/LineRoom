import { Header } from "@/components/Header";

/** Instant outline while a saved song editor route loads. */
export function SongEditorSkeleton() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950">
      <div className="hidden lg:block">
        <Header showDashboardLink />
      </div>

      <div className="hidden shrink-0 border-b border-zinc-800/80 px-4 py-2.5 lg:block">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-3">
          <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-800/60" />
          <div className="ml-auto h-8 w-32 animate-pulse rounded-md bg-zinc-800/60" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col border-zinc-800/80 lg:border-r">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 px-3 py-2 lg:hidden">
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-800/70" />
            <div className="h-5 flex-1 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-800/70" />
          </div>
          <div className="min-h-0 flex-1 animate-pulse p-4">
            <div className="mx-auto h-full max-w-3xl rounded-lg border border-zinc-800/60 bg-zinc-900/30" />
          </div>
        </div>

        <div className="hidden min-h-0 w-[min(100%,420px)] shrink-0 flex-col border-l border-zinc-800/80 lg:flex">
          <div className="flex shrink-0 gap-2 border-b border-zinc-800/80 px-4 py-3">
            <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-800/70" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-zinc-800/60" />
          </div>
          <div className="min-h-0 flex-1 space-y-3 p-4">
            <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
            <div className="h-24 animate-pulse rounded-xl bg-zinc-900/40" />
            <div className="h-24 animate-pulse rounded-xl bg-zinc-900/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
