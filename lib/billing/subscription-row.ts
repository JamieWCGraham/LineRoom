import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRow } from "@/types/database";

const ACTIVE = new Set(["active", "trialing"]);

export function subscriptionIsPaid(row: SubscriptionRow | null): boolean {
  if (!row?.status) return false;
  return ACTIVE.has(row.status);
}

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
    console.error("[billing] fetchSubscriptionForUser", error.message);
    return null;
  }
  return data as SubscriptionRow | null;
}
