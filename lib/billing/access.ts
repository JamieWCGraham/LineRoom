import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getFreeCritiqueQuota,
  isBillingBypassed,
} from "@/lib/billing/config";
import { fetchSubscriptionForUser, subscriptionIsPaid } from "@/lib/billing/subscription-row";
import { reconcileSubscriptionForUser } from "@/lib/billing/reconcile";
import type { CritiqueAccessState } from "@/lib/billing/types";
import type { CritiqueUsageRow } from "@/types/database";

export async function fetchCritiqueUsageForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CritiqueUsageRow | null> {
  const { data, error } = await supabase
    .from("critique_usage")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[billing] fetchCritiqueUsageForUser", error.message);
    return null;
  }
  return data as CritiqueUsageRow | null;
}

export async function getCritiqueAccessForUser(
  supabase: SupabaseClient,
  user: User | null,
): Promise<CritiqueAccessState> {
  const freeQuota = getFreeCritiqueQuota();

  if (!user) {
    return {
      isBypassed: false,
      hasActiveSubscription: false,
      freeQuota,
      usedFreeCritiques: 0,
      remainingFreeCritiques: 0,
      canGenerateCritique: false,
      reason: "unauthenticated",
      currentPeriodEnd: null,
    };
  }

  const email = user.email ?? "";
  if (isBillingBypassed(email)) {
    const usage = await fetchCritiqueUsageForUser(supabase, user.id);
    const used = usage?.successful_critiques_used ?? 0;
    return {
      isBypassed: true,
      hasActiveSubscription: false,
      freeQuota,
      usedFreeCritiques: used,
      remainingFreeCritiques: Math.max(0, freeQuota - used),
      canGenerateCritique: true,
      reason: "bypassed",
      currentPeriodEnd: null,
    };
  }

  let sub = await fetchSubscriptionForUser(supabase, user.id);
  let hasActiveSubscription = subscriptionIsPaid(sub);

  if (!hasActiveSubscription) {
    const reconcile = await reconcileSubscriptionForUser(user.id, email);
    if (reconcile.attempted) {
      sub = await fetchSubscriptionForUser(supabase, user.id);
      hasActiveSubscription = subscriptionIsPaid(sub);
    }
  }

  if (hasActiveSubscription) {
    const usage = await fetchCritiqueUsageForUser(supabase, user.id);
    const used = usage?.successful_critiques_used ?? 0;
    return {
      isBypassed: false,
      hasActiveSubscription: true,
      freeQuota,
      usedFreeCritiques: used,
      remainingFreeCritiques: Math.max(0, freeQuota - used),
      canGenerateCritique: true,
      reason: "subscribed",
      currentPeriodEnd: sub?.current_period_end ?? null,
    };
  }

  const usage = await fetchCritiqueUsageForUser(supabase, user.id);
  const used = usage?.successful_critiques_used ?? 0;
  const remaining = Math.max(0, freeQuota - used);
  const canGenerate = used < freeQuota;

  return {
    isBypassed: false,
    hasActiveSubscription: false,
    freeQuota,
    usedFreeCritiques: used,
    remainingFreeCritiques: remaining,
    canGenerateCritique: canGenerate,
    reason: canGenerate ? "free_remaining" : "quota_exhausted",
    currentPeriodEnd: null,
  };
}
