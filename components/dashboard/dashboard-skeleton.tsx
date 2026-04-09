import { AppBrandDash } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";

export function DashboardSkeleton({ email }: { email: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <AppBrandDash />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Signed in as{" "}
            <span className="font-medium text-zinc-200">{email}</span>
          </p>
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

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-800" />
        </div>
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
