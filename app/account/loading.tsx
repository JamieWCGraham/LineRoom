export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] max-lg:pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] sm:px-6 lg:py-8">
      <div className="rounded-[28px] border border-zinc-700/50 bg-zinc-900/85 p-6">
        <div className="mx-auto h-6 w-24 animate-pulse rounded bg-zinc-800/70" />
        <div className="mx-auto mt-5 h-20 w-20 animate-pulse rounded-full bg-zinc-800/80" />
        <div className="mx-auto mt-4 h-8 w-48 animate-pulse rounded bg-zinc-800/70" />
        <div className="mx-auto mt-2 h-5 w-36 animate-pulse rounded bg-zinc-800/60" />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/60" />
          <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="mt-3 h-10 w-full animate-pulse rounded-xl bg-zinc-700/60" />
          </div>
        </div>

        <div>
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/60" />
          <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-4">
            <div className="h-5 w-24 animate-pulse rounded bg-zinc-800/60" />
            <div className="mt-3 h-10 w-full animate-pulse rounded-xl bg-zinc-800/50" />
          </div>

          <div className="mt-5 h-3 w-16 animate-pulse rounded bg-zinc-800/60" />
          <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
          </div>

          <div className="mt-5 h-3 w-24 animate-pulse rounded bg-zinc-800/60" />
          <div className="mt-2 rounded-2xl border border-red-900/40 bg-red-950/10 p-4">
            <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-800/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
