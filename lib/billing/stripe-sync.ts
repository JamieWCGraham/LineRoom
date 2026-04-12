import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

function customerId(cust: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof cust === "string" ? cust : cust.id;
}

/**
 * Upserts `subscriptions` from a Stripe Subscription object.
 * Prefers `explicitUserId`, then `subscription.metadata.supabase_user_id`,
 * then lookup by `stripe_customer_id`.
 */
export async function upsertSubscriptionFromStripe(
  admin: SupabaseClient,
  stripeSub: Stripe.Subscription,
  explicitUserId?: string | null,
): Promise<void> {
  let userId =
    explicitUserId?.trim() ||
    stripeSub.metadata?.supabase_user_id?.trim() ||
    null;

  const custId = customerId(stripeSub.customer);

  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", custId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }

  if (!userId) {
    console.error(
      "[stripe] Cannot resolve user for subscription",
      stripeSub.id,
    );
    return;
  }

  const { data: prior } = await admin
    .from("subscriptions")
    .select("created_at")
    .eq("user_id", userId)
    .maybeSingle();

  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : null;
  const now = new Date().toISOString();

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: custId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: priceId,
      status: stripeSub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      updated_at: now,
      created_at: prior?.created_at ?? now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[stripe] upsert subscriptions", error.message);
  }
}
