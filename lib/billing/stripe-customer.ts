import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { billingLog } from "@/lib/billing/logger";

/**
 * Ensures a Stripe customer exists for the given user and returns the customer ID.
 *
 * If a `subscriptions` row already has a `stripe_customer_id`, it is returned
 * immediately. Otherwise a new Stripe customer is created, and a skeleton row
 * is upserted so the webhook can later fill in subscription details.
 */
export async function getOrCreateStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { supabase_user_id: userId },
  });

  const now = new Date().toISOString();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      email: email ? email.trim().toLowerCase() : null,
      stripe_customer_id: customer.id,
      updated_at: now,
      created_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    billingLog.error("Failed to persist Stripe customer", {
      userId,
      stripeCustomerId: customer.id,
      error: error.message,
    });
    throw new Error("Failed to save Stripe customer");
  }

  billingLog.info("Created Stripe customer", { userId, stripeCustomerId: customer.id });
  return customer.id;
}
