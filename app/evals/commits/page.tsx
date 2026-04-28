import Link from "next/link";
import { redirect } from "next/navigation";
import { AppBrandDash } from "@/components/app-brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EvalsCommitsClient } from "@/components/evals/evals-commits-client";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { isBillingBypassed } from "@/lib/billing/config";
import { getAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function EvalsCommitsPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const { email } = normalizeAuthUserToProfile(user);
  if (!isBillingBypassed(email)) redirect("/");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <AppBrandDash />
      <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Github Insight Engine</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Main branch Github commit history with LLM summaries (default branch from the API). Search and filter the loaded set; use
            &quot;Load more&quot; to pull additional pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/evals"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Back to Evals
          </Link>
          <SignOutButton />
        </div>
      </div>
      <EvalsCommitsClient />
    </div>
  );
}
