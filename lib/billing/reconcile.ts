import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { subscriptionIsPaid } from "@/lib/billing/subscription-row";
import { billingLog } from "@/lib/billing/logger";
import type { SubscriptionRow } from "@/types/database";

export interface ReconcileResult {
  attempted: boolean;
  hasPaidSubscription: boolean;
}

const PAID = new Set(["active", "trialing"]);
const TERMINAL = new Set(["canceled", "incomplete_expired"]);

function isPaid(status: string | null): boolean {
  return status !== null && PAID.has(status);
}

function isTerminal(status: string | null): boolean {
  return status !== null && TERMINAL.has(status);
}

/**
 * Finds the best subscription for a customer from Stripe's subscription list.
 *
 * Prefers an active/trialing subscription. If none exists, returns the most
 * recently created one (Stripe returns them in reverse chronological order).
 */
function pickBestSubscription(
  subs: import("stripe").Stripe.Subscription[],
): import("stripe").Stripe.Subscription | null {
  return subs.find((s) => isPaid(s.status)) ?? subs[0] ?? null;
}

/**
 * Reconciles the local `subscriptions` row for a user against Stripe.
 *
 * This is a **defensive fallback** for when a webhook may have been missed
 * (local dev, temporary endpoint downtime, etc.). It tries three resolution
 * strategies in order of specificity:
 *
 *  1. Retrieve by `stripe_subscription_id` — if still active, sync and return.
 *     If the stored subscription is in a terminal state (canceled), **fall
 *     through** to the customer listing so we can discover a newer subscription
 *     the user may have created after re-subscribing.
 *  2. List subscriptions for `stripe_customer_id`, pick the best one.
 *  3. Search Stripe customers by email, then list their subscriptions.
 *
 * After finding the most relevant Stripe subscription it upserts the row via
 * {@link upsertSubscriptionFromStripe}, keeping a single write-path.
 */
export async function reconcileSubscriptionForUser(
  userId: string,
  email?: string | null,
): Promise<ReconcileResult> {
  if (!userId) return { attempted: false, hasPaidSubscription: false };

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { attempted: false, hasPaidSubscription: false };
  }

  const { data: row, error } = await admin
    .from("subscriptions")
    .select(
      "stripe_customer_id, stripe_subscription_id, billing_provider, status, current_period_end, app_store_original_transaction_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    billingLog.error("Reconcile: failed to read local row", { userId, error: error.message });
    return { attempted: false, hasPaidSubscription: false };
  }

  const subRow = row as SubscriptionRow | null;
  const appleBilling = subRow?.billing_provider === "app_store";
  const appleLooksCurrent =
    appleBilling &&
    (subRow.status === "active" || subRow.status === "trialing") &&
    Boolean(subRow.app_store_original_transaction_id?.trim());

  if (appleLooksCurrent) {
    const paid = subscriptionIsPaid(subRow);
    return { attempted: false, hasPaidSubscription: paid };
  }

  const normalizedEmail = email?.trim().toLowerCase() || null;
  const custId = row?.stripe_customer_id?.trim() || null;

  try {
    const stripe = getStripe();

    // 1. Direct subscription retrieval — but fall through when terminal
    const subId = row?.stripe_subscription_id?.trim();
    if (subId) {
      const stripeSub = await stripe.subscriptions.retrieve(subId);

      if (!isTerminal(stripeSub.status)) {
        const result = await upsertSubscriptionFromStripe(admin, stripeSub, {
          explicitUserId: userId,
          explicitEmail: normalizedEmail,
        });
        return { attempted: true, hasPaidSubscription: isPaid(result.status) };
      }

      // Stored subscription is canceled/expired — there may be a newer one.
      // Fall through to customer listing instead of returning immediately.
      billingLog.info("Reconcile: stored subscription is terminal, checking customer", {
        userId,
        stripeSubscriptionId: subId,
        status: stripeSub.status,
      });
    }

    // 2. Customer subscription list — picks active over canceled
    if (custId) {
      const list = await stripe.subscriptions.list({
        customer: custId,
        status: "all",
        limit: 10,
      });
      const best = pickBestSubscription(list.data);
      if (!best) return { attempted: true, hasPaidSubscription: false };

      const result = await upsertSubscriptionFromStripe(admin, best, {
        explicitUserId: userId,
        explicitEmail: normalizedEmail,
      });
      return { attempted: true, hasPaidSubscription: isPaid(result.status) };
    }

    // 3. Email-based customer search
    if (normalizedEmail) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 5 });

      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 5,
        });

        const target = pickBestSubscription(subs.data);
        if (!target) continue;

        const result = await upsertSubscriptionFromStripe(admin, target, {
          explicitUserId: userId,
          explicitEmail: customer.email?.trim().toLowerCase() ?? normalizedEmail,
        });
        return { attempted: true, hasPaidSubscription: isPaid(result.status) };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Reconcile: Stripe API error", { userId, error: msg });
  }

  return { attempted: false, hasPaidSubscription: false };
}
