import { AppBrandDash } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";

export function DashboardSkeleton(props?: { email?: string }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-zinc-950 px-4 py-12 md:min-h-0 md:bg-transparent md:px-4 md:py-12">
      <AppBrandDash />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
          {props?.email ?
            <p className="mt-2 text-sm text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-zinc-200">{props.email}</span>
            </p>
          : <div className="mt-2 h-5 w-48 animate-pulse rounded bg-zinc-800/70" />}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/account"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="mt-8">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl bg-zinc-900/80" />
          <div className="h-32 animate-pulse rounded-xl bg-zinc-900/80" />
        </div>
      </section>

      <section className="mt-0 px-4 pb-8 md:mt-10 md:px-0 md:pb-0">
        <div className="mb-3 hidden h-4 w-24 animate-pulse rounded bg-zinc-800 md:block" />
        <div className="mt-4 space-y-2">
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
