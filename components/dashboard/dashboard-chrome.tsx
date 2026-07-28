import type { ReactNode } from "react";
import Link from "next/link";
import { AppBrandLogo } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { DashboardStats } from "@/lib/songs/dashboardSongs";

type Props = {
  displayName: string;
  stats: DashboardStats;
  showEvalsNav: boolean;
  createError?: boolean;
};

function EvalsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex min-w-[7rem] flex-col items-center rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3 text-center">
      <span className="text-emerald-400">{icon}</span>
      <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-300">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
    </div>
  );
}

export function DashboardChrome({
  displayName,
  stats,
  showEvalsNav,
  createError,
}: Props) {
  return (
    <>
      <div className="hidden md:block">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AppBrandLogo size={40} className="h-9 w-9" />
            <p className="text-2xl font-bold tracking-tight text-zinc-50">
              LineRoom
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showEvalsNav ?
              <>
                <Link
                  href="/evals"
                  prefetch
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-600/60 hover:bg-emerald-950/40"
                >
                  <EvalsIcon />
                  Evals
                </Link>
                <Link
                  href="/admin"
                  prefetch
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/25 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-600/60 hover:bg-amber-950/40"
                >
                  Admin
                </Link>
              </>
            : null}
            <Link
              href="/account"
              prefetch
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
            >
              <UserIcon />
              Account
            </Link>
            <div className="[&_button]:w-auto [&_button]:rounded-lg [&_button]:px-4 [&_button]:py-2">
              <SignOutButton />
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Draft, shape, and refine lyrics in real time.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <StatCard
                icon={<DocumentIcon />}
                value={stats.totalPieces}
                label="Total pieces"
              />
              {stats.standoutPieces > 0 ?
                <StatCard
                  icon={<StarIcon />}
                  value={stats.standoutPieces}
                  label="Standout pieces"
                />
              : null}
              <StatCard
                icon={<ClockIcon />}
                value={stats.lastActivity}
                label="Last activity"
              />
            </div>
          </div>
        </section>
      </div>

      {createError ?
        <p className="mx-4 mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:mx-0 md:mt-4">
          Could not create a new piece. Check your connection and try again.
        </p>
      : null}
    </>
  );
}

export function DashboardFooter() {
  return (
    <footer className="mt-12 hidden pb-4 text-center text-xs text-zinc-600 md:block">
      © 2026 LineRoom. All rights reserved.
    </footer>
  );
}
