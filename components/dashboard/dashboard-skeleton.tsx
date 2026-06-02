import Link from "next/link";
import { AppBrandLogo } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DASHBOARD_TABLE_GRID } from "@/components/dashboard/dashboard-table";

export function DashboardSkeleton() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-zinc-950 px-4 py-12 md:min-h-0 md:max-w-7xl md:bg-transparent md:px-6 md:py-12 lg:max-w-[88rem] lg:px-8">
      <div className="hidden md:block">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AppBrandLogo size={40} className="h-9 w-9" />
            <p className="text-2xl font-bold tracking-tight text-zinc-50">LineRoom</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/account"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200"
            >
              Account
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-8 w-64 max-w-full animate-pulse rounded bg-zinc-800/70" />
              <div className="h-4 w-72 max-w-full animate-pulse rounded bg-zinc-800/50" />
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[5.5rem] w-28 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-950/50"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-0.5 rounded-full bg-zinc-700" aria-hidden />
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-28 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/50" />
            <div className="h-28 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/50" />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-0.5 rounded-full bg-zinc-700" aria-hidden />
              <div className="h-5 w-28 animate-pulse rounded bg-zinc-800" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/70" />
          </div>
          <div className="mb-4 grid grid-cols-[1fr_auto_auto] gap-3">
            <div className="h-10 animate-pulse rounded-md bg-zinc-900/70" />
            <div className="h-10 w-36 animate-pulse rounded-md bg-zinc-900/70" />
            <div className="h-10 w-44 animate-pulse rounded-md bg-zinc-900/70" />
          </div>
          <div className="rounded-lg border border-zinc-800">
            <div
              className={`${DASHBOARD_TABLE_GRID} border-b border-zinc-800 px-4 py-2.5`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-3 w-12 animate-pulse rounded bg-zinc-800/60" />
              ))}
            </div>
            <div className="divide-y divide-zinc-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${DASHBOARD_TABLE_GRID} px-4 py-3.5`}>
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/70" />
                  <div className="h-3 w-36 animate-pulse rounded bg-zinc-800/50" />
                  <div className="h-5 w-20 animate-pulse rounded bg-zinc-800/50" />
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/50" />
                  <div className="h-7 w-28 animate-pulse rounded bg-zinc-800/50 justify-self-end" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-0 px-0 pb-8 md:hidden">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-zinc-900/70"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
