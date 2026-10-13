import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { SubscriptionStatus } from "@/types/database";
import { billingLog } from "@/lib/billing/logger";
import { track } from "@/lib/analytics";

// ── Helpers ─────────────────────────────────────────────────

function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
  return typeof customer === "string" ? customer : customer.id;
}

type ResolutionSource = "explicit" | "metadata" | "subscription_lookup" | "customer_lookup";

interface ResolvedUser {
  userId: string;
  source: ResolutionSource;
}

/**
 * Resolves the Supabase `user_id` that owns a Stripe subscription.
 *
 * Tried in order:
 *  1. Explicitly supplied ID (from checkout session metadata)
 *  2. `supabase_user_id` in the subscription's own metadata
 *  3. DB lookup by `stripe_subscription_id`
 *  4. DB lookup by `stripe_customer_id` (opt-in via `allowCustomerLookup`)
 */
async function resolveUserId(
  admin: SupabaseClient,
  stripeSub: Stripe.Subscription,
  explicitUserId: string | null | undefined,
  allowCustomerLookup: boolean,
): Promise<ResolvedUser | null> {
  const explicit = explicitUserId?.trim();
  if (explicit) return { userId: explicit, source: "explicit" };

  const meta = stripeSub.metadata?.supabase_user_id?.trim();
  if (meta) return { userId: meta, source: "metadata" };

  const { data: bySubId } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSub.id)
    .maybeSingle();
  if (bySubId?.user_id) return { userId: bySubId.user_id, source: "subscription_lookup" };

  if (allowCustomerLookup) {
    const custId = extractCustomerId(stripeSub.customer);
    const { data: byCust } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", custId)
      .maybeSingle();
    if (byCust?.user_id) return { userId: byCust.user_id, source: "customer_lookup" };
  }

  return null;
}

// ── Public API ──────────────────────────────────────────────

export interface SyncOptions {
  explicitUserId?: string | null;
  explicitEmail?: string | null;
  /** Force a status instead of mirroring `stripeSub.status`. */
  statusOverride?: SubscriptionStatus;
  /** Allow fallback to customer-ID lookup when resolving the user. Default `true`. */
  allowCustomerLookup?: boolean;
}

export interface SyncResult {
  success: boolean;
  userId: string | null;
  status: SubscriptionStatus | null;
  source: ResolutionSource | null;
}

/**
 * Upserts a `subscriptions` row so that Supabase mirrors the given Stripe
 * Subscription object.
 *
 * This is the **only** function that writes subscription state to the database
 * during the normal webhook flow. Keeping a single write-path makes the
 * data-flow easy to audit and avoids divergent state.
 *
 * @returns A {@link SyncResult} describing what happened so callers can log /
 *          react without querying the DB again.
 */
export async function upsertSubscriptionFromStripe(
  admin: SupabaseClient,
  stripeSub: Stripe.Subscription,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const {
    explicitUserId,
    explicitEmail,
    statusOverride,
    allowCustomerLookup = true,
  } = opts;

  const resolved = await resolveUserId(admin, stripeSub, explicitUserId, allowCustomerLookup);
  if (!resolved) {
    billingLog.error("Cannot resolve user for subscription", {
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: extractCustomerId(stripeSub.customer),
    });
    return { success: false, userId: null, status: null, source: null };
  }

  const { userId, source } = resolved;
  const customerId = extractCustomerId(stripeSub.customer);
  const status: SubscriptionStatus = statusOverride ?? (stripeSub.status as SubscriptionStatus);
  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : null;

  const { data: prior } = await admin
    .from("subscriptions")
    .select("created_at, email, status")
    .eq("user_id", userId)
    .maybeSingle();

  const email =
    explicitEmail?.trim().toLowerCase() ||
    stripeSub.metadata?.email?.trim().toLowerCase() ||
    prior?.email?.trim().toLowerCase() ||
    null;

  const now = new Date().toISOString();

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      email,
      billing_provider: "stripe",
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: priceId,
      app_store_original_transaction_id: null,
      app_store_product_id: null,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      updated_at: now,
      created_at: prior?.created_at ?? now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    billingLog.error("Subscription upsert failed", {
      userId,
      stripeSubscriptionId: stripeSub.id,
      status,
      error: error.message,
    });
    return { success: false, userId, status, source };
  }

  billingLog.info("Subscription synced", {
    userId,
    stripeSubscriptionId: stripeSub.id,
    stripeCustomerId: customerId,
    status,
    periodEnd,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    resolvedVia: source,
  });

  const priorStatus = prior?.status ?? null;
  const nowPaid = status === "active" || status === "trialing";
  const wasPaid = priorStatus === "active" || priorStatus === "trialing";
  if (nowPaid && !wasPaid) {
    await track("pro_purchased", { plan: "pro" });
  }

  return { success: true, userId, status, source };
}
