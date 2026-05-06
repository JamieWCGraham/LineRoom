export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-[max(3rem,calc(env(safe-area-inset-top,0px)+1.5rem))] max-lg:pb-[max(3rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] lg:py-12">
      <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-800/80" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-zinc-800/60" />
      <div className="mt-8 space-y-3">
        <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-zinc-800/40" />
      </div>
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/60" />
        <div className="mt-3 h-10 w-28 animate-pulse rounded-lg bg-zinc-800/50" />
      </div>
      <div className="mt-8 space-y-3 border-t border-zinc-800 pt-8">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/60" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-zinc-800/40" />
      </div>
    </div>
  );
}
