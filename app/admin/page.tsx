import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDeleteUserPanel } from "@/components/admin/AdminDeleteUserPanel";
import { AdminStatsPanel } from "@/components/admin/AdminStatsPanel";
import { AppBrandDash } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { hasEvalsAccess } from "@/lib/evals/access";
import { getAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const { email } = normalizeAuthUserToProfile(user);
  if (!hasEvalsAccess(email)) redirect("/");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <AppBrandDash />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Internal tools for account management and platform metrics.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Dashboard
          </Link>
          <Link
            href="/evals"
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-600/60 hover:bg-emerald-950/40"
          >
            Evals
          </Link>
          <Link
            href="/account"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>

      <AdminStatsPanel />
      <AdminDeleteUserPanel />
    </div>
  );
}
