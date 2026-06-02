import Link from "next/link";
import { AppBrandDash } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";

type Props = {
  email: string;
  showEvalsNav: boolean;
  createError?: boolean;
};

export function DashboardChrome({ email, showEvalsNav, createError }: Props) {
  return (
    <>
      <div className="hidden md:block">
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
            {showEvalsNav ?
              <Link
                href="/evals"
                prefetch
                className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-600/60 hover:bg-emerald-950/40"
              >
                Evals
              </Link>
            : null}
            <Link
              href="/account"
              prefetch
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Account
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>

      {createError ?
        <p className="mx-4 mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:mx-0 md:mt-4">
          Could not create a new piece. Check your connection and try again.
        </p>
      : null}
    </>
  );
}
