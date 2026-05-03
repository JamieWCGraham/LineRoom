import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRow, SubscriptionStatus } from "@/types/database";
import { billingLog } from "@/lib/billing/logger";

/** Statuses that represent an actively-paid subscription. */
const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["active", "trialing"]);

/**
 * Returns `true` when the subscription row represents a currently-paid plan.
 * Both `active` and `trialing` are treated as paid.
 */
export function subscriptionIsPaid(row: SubscriptionRow | null): boolean {
  if (!row?.status) return false;
  if (!PAID_STATUSES.has(row.status)) return false;
  const provider = row.billing_provider ?? "stripe";
  if (provider === "app_store") {
    if (!row.current_period_end) return false;
    return new Date(row.current_period_end) > new Date();
  }
  return true;
}

/**
 * Fetches the single `subscriptions` row for a user.
 * Returns `null` if no row exists or on query error.
 */
export async function fetchSubscriptionForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    billingLog.error("Failed to fetch subscription", { userId, error: error.message });
    return null;
  }
  return data as SubscriptionRow | null;
}
