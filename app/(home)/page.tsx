import Link from "next/link";
import { AppBrandLogo } from "@/components/app-brand";
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { DashboardPieces } from "@/components/dashboard/dashboard-pieces-async";
import {
  PrefetchDashboardRoutes,
  PrefetchPublicLandingAuth,
} from "@/components/navigation/route-prefetch";
import { LandingLyricPreview } from "@/components/LandingLyricPreview";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { getAuthUser } from "@/lib/auth/guards";
import { isBillingBypassed } from "@/lib/billing/config";
import { loadDashboardSongs } from "@/lib/songs/dashboardSongs";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ createError?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden">
        <PrefetchPublicLandingAuth />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.2),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(52,211,153,0.12),transparent_40%)]"
          aria-hidden
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-16 sm:px-6 lg:py-24">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <AppBrandLogo size={48} className="h-10 w-10 sm:h-11 sm:w-11" priority />
              <p className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                LineRoom
              </p>
            </div>
            <div className="hidden gap-3 sm:flex">
              <Link
                href="/login"
                prefetch
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
              >
                Login
              </Link>
              <Link
                href="/signup"
                prefetch
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white"
              >
                Sign up
              </Link>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl shadow-black/30 backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:gap-x-10 md:gap-y-10 md:p-12">
            <div className="order-1 min-w-0 md:order-none md:col-start-1 md:row-start-1 md:self-start">
              <p className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-200">
                Songwriting Workspace
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
                Write better lyrics with feedback that actually helps.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                Draft, revise, and strengthen your lyrics with real-time, line-by-line feedback.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Highlighted feedback shows what&apos;s working, what&apos;s developing, and
                what to strengthen.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  prefetch
                  className="rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                >
                  Start writing for free
                </Link>
                <Link
                  href="/login"
                  prefetch
                  className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  Log in
                </Link>
              </div>
            </div>

            <div className="order-2 col-span-full w-full md:order-none md:col-span-2 md:col-start-1 md:row-start-2">
              <LandingLyricPreview embedded />
            </div>

            <div className="order-3 shrink-0 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-5 md:order-none md:col-start-2 md:row-start-1 md:self-start">
              <p className="text-sm font-medium text-zinc-200">Why creators use LineRoom</p>
              <ul className="mt-4 space-y-4 text-sm text-zinc-400">
                <li className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  Never lose your best lines while rewriting.
                </li>
                <li className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  See exactly which lines are working - and which aren&apos;t.
                </li>
                <li className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  Pick up your song anywhere without breaking your flow.
                </li>
              </ul>
            </div>
          </section>

          <div className="flex gap-3 sm:hidden">
            <Link
              href="/login"
              prefetch
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
            >
              Login
            </Link>
            <Link
              href="/signup"
              prefetch
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>
    );
  }
  const { email } = normalizeAuthUserToProfile(user);
  const showEvalsNav = isBillingBypassed(email);
  const q = await searchParams;
  const songs = await loadDashboardSongs(supabase, user.id);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-zinc-950 md:min-h-0 md:bg-transparent md:px-4 md:py-12">
      <PrefetchDashboardRoutes includeEvals={showEvalsNav} />
      <DashboardChrome
        email={email}
        showEvalsNav={showEvalsNav}
        createError={q.createError === "1"}
      />
      <DashboardPieces songs={songs} email={email} showEvalsNav={showEvalsNav} />
    </div>
  );
}
