import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

function customerId(cust: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof cust === "string" ? cust : cust.id;
}

/**
 * Upserts `subscriptions` from a Stripe Subscription object.
 * Prefers `explicitUserId`, then `subscription.metadata.supabase_user_id`,
 * then lookup by `stripe_subscription_id`, then `stripe_customer_id`.
 */
export async function upsertSubscriptionFromStripe(
  admin: SupabaseClient,
  stripeSub: Stripe.Subscription,
  explicitUserId?: string | null,
  explicitEmail?: string | null,
  options?: {
    statusOverride?: Stripe.Subscription.Status;
    allowCustomerLookup?: boolean;
  },
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
      .eq("stripe_subscription_id", stripeSub.id)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }

  const allowCustomerLookup = options?.allowCustomerLookup ?? true;

  if (!userId && allowCustomerLookup) {
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
    .select("created_at, email")
    .eq("user_id", userId)
    .maybeSingle();

  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : null;
  const status = options?.statusOverride ?? stripeSub.status;
  const subscriptionEmail =
    explicitEmail?.trim().toLowerCase() ||
    stripeSub.metadata?.email?.trim().toLowerCase() ||
    prior?.email?.trim().toLowerCase() ||
    null;
  const now = new Date().toISOString();

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      email: subscriptionEmail,
      stripe_customer_id: custId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: priceId,
      status,
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
