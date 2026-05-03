import Link from "next/link";
import { BillingSection } from "@/components/account/BillingSection";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { ProfileForm } from "@/components/account/profile-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { reconcileSubscriptionForUser } from "@/lib/billing/reconcile";
import { ensureProfile } from "@/lib/auth/profile";
import { requireAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

type Props = {
  searchParams: Promise<{ saved?: string; portal_return?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await ensureProfile(supabase, user);
    const again = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = again.data;
  }

  const q = await searchParams;

  if (q.portal_return) {
    await reconcileSubscriptionForUser(user.id, user.email);
  }

  const billingAccess = await getCritiqueAccessForUser(supabase, user);

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-[max(3rem,calc(env(safe-area-inset-top,0px)+1.5rem))] max-lg:pb-[max(3rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] lg:py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Account</h1>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/" className="text-zinc-400 underline">
          Dashboard
        </Link>
        {" · "}
        <Link href="/lineroom" className="text-zinc-400 underline">
          LineRoom
        </Link>
      </p>
      {q.saved === "1" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          Profile saved.
        </p>
      ) : null}
      <div className="mt-8">
        <ProfileForm profile={profile as ProfileRow | null} />
      </div>
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-medium text-zinc-300">Session</h2>
        <p className="mt-1 text-xs text-zinc-500">Sign out on this device.</p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
      <BillingSection initialAccess={billingAccess} />
      {user.email ?
        <DeleteAccountSection userEmail={user.email} />
      : null}
    </div>
  );
}
