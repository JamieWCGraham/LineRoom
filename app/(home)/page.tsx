import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { DashboardPieces } from "@/components/dashboard/dashboard-pieces-async";
import {
  PrefetchDashboardRoutes,
  PrefetchPublicLandingAuth,
} from "@/components/navigation/route-prefetch";
import { LandingLyricPreview } from "@/components/LandingLyricPreview";
import { Testimonials } from "@/components/marketing/Testimonials";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { ensureProfile, normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { getAuthUser } from "@/lib/auth/guards";
import { hasEvalsAccess } from "@/lib/evals/access";
import {
  computeDashboardStats,
  loadDashboardSongs,
} from "@/lib/songs/dashboardSongs";
import { IOS_APP_STORE_URL } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ createError?: string }>;
};

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage({ searchParams }: Props) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const showLanding = !user || Boolean(user.is_anonymous);
  if (showLanding) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden">
        <PrefetchPublicLandingAuth />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.2),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(52,211,153,0.12),transparent_40%)]"
          aria-hidden
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-16 sm:px-6 lg:py-24">
          <MarketingHeader hideNavOnMobile />

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
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                AI-powered line-by-line feedback, tuned to the artists and genre you provide. Your words stay yours.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Highlighted feedback shows what&apos;s working, what&apos;s developing, and
                what to strengthen.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/lineroom"
                  prefetch
                  className="rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                >
                  Try without signing up
                </Link>
                {IOS_APP_STORE_URL ?
                  <a
                    href={IOS_APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
                  >
                    Download on the App Store
                  </a>
                : null}
                <Link
                  href="/signup"
                  prefetch
                  className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  Sign up
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
                  See exactly which lines are working, and which aren&apos;t.
                </li>
                <li className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  Pick up your song anywhere without breaking your flow.
                </li>
              </ul>
            </div>
          </section>

          <Testimonials />

          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex gap-3">
              <Link
                href="/pricing"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-center text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900/70 hover:text-zinc-200"
              >
                Pricing
              </Link>
              <Link
                href="/features"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-center text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900/70 hover:text-zinc-200"
              >
                Features
              </Link>
            </div>
            <div className="flex gap-3">
              <Link
                href="/lineroom"
                prefetch
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white"
              >
                Try free
              </Link>
              <Link
                href="/login"
                prefetch
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
              >
                Login
              </Link>
            </div>
            {IOS_APP_STORE_URL ?
              <a
                href={IOS_APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
              >
                Download on the App Store
              </a>
            : null}
          </div>
        </div>
      </main>
    );
  }
  const { email } = normalizeAuthUserToProfile(user);
  const showEvalsNav = hasEvalsAccess(email);
  const q = await searchParams;

  const [songs, profileResult] = await Promise.all([
    loadDashboardSongs(supabase, user.id),
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  let profile = profileResult.data;
  if (!profile) {
    await ensureProfile(supabase, user);
    const again = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    profile = again.data;
  }

  const displayName = resolveDisplayName(profile, user);
  const stats = computeDashboardStats(songs);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-zinc-950 md:min-h-0 md:max-w-7xl md:bg-transparent md:px-6 md:py-12 lg:max-w-[88rem] lg:px-8">
      <PrefetchDashboardRoutes includeEvals={showEvalsNav} />
      <DashboardChrome
        displayName={displayName}
        stats={stats}
        showEvalsNav={showEvalsNav}
        createError={q.createError === "1"}
      />
      <DashboardPieces songs={songs} email={email} showEvalsNav={showEvalsNav} />
    </div>
  );
}
