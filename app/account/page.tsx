import Link from "next/link";
import { PrefetchAccountNav } from "@/components/navigation/route-prefetch";
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
  const profileRow = profile as ProfileRow | null;
  const displayName =
    profileRow?.display_name?.trim() ||
    profileRow?.username?.trim() ||
    user.email?.split("@")[0] ||
    "LineRoom user";
  const subLabel =
    profileRow?.username?.trim() || user.email || "Update your profile";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "LR";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] max-lg:pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] sm:px-6 lg:py-8">
      <PrefetchAccountNav />
      <header className="rounded-[28px] border border-zinc-700/50 bg-zinc-900/85 p-6 text-center shadow-[0_14px_32px_-22px_rgba(0,0,0,0.95)]">
        <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-sky-600/80 text-3xl font-semibold text-white">
          {initials}
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
          {displayName}
        </p>
        <p className="mt-1 text-lg text-zinc-400">{subLabel}</p>
        <p className="mt-4 flex justify-center gap-3 text-sm text-zinc-500">
          <Link href="/" prefetch className="underline underline-offset-2 hover:text-zinc-300">
            Dashboard
          </Link>
          <span aria-hidden>•</span>
          <Link
            href="/lineroom"
            prefetch
            className="underline underline-offset-2 hover:text-zinc-300"
          >
            LineRoom
          </Link>
        </p>
        {q.saved === "1" ? (
          <p className="mt-4 inline-flex rounded-full border border-emerald-800/70 bg-emerald-950/40 px-4 py-1.5 text-sm text-emerald-200">
            Profile saved successfully.
          </p>
        ) : null}
      </header>

      <section className="mt-6">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Profile
        </p>
        <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-4 sm:p-5">
          <ProfileForm profile={profileRow} />
        </div>
      </section>

      <section className="mt-5">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Account
        </p>
        <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-100">Session</h2>
          <p className="mt-1 text-sm text-zinc-500">Signed in on this device.</p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </section>

      <div className="mt-5 space-y-5">
        <BillingSection initialAccess={billingAccess} />
        {user.email ?
          <DeleteAccountSection userEmail={user.email} />
        : null}
      </div>
    </div>
  );
}
