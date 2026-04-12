import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

/**
 * Returns Stripe customer id for the user, creating the customer and row as needed.
 * Caller must have verified `userId` matches the session user.
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

  const cid = existing?.stripe_customer_id as string | null | undefined;
  if (cid) return cid;

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
    console.error("[billing] upsert subscription row for customer", error.message);
    throw new Error("Failed to save Stripe customer");
  }

  return customer.id;
}
