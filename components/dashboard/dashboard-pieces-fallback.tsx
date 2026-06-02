/** Shown while dashboard piece rows load (Suspense + route loading). */
export function DashboardPiecesFallback() {
  return (
    <>
      <section className="mt-8 hidden md:block">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl bg-zinc-900/80" />
          <div className="h-32 animate-pulse rounded-xl bg-zinc-900/80" />
        </div>
      </section>

      <section className="mt-0 px-4 pb-8 md:mt-10 md:px-0 md:pb-0">
        <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-zinc-800/80 bg-zinc-950 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <div className="h-12 animate-pulse rounded-2xl bg-zinc-800/90" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-900/60" />
        </div>
        <div className="mb-3 hidden h-4 w-24 animate-pulse rounded bg-zinc-800 md:mt-4 md:block" />
        <div className="mt-4 space-y-2 md:mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-zinc-900/70"
            />
          ))}
        </div>
      </section>
    </>
  );
}
