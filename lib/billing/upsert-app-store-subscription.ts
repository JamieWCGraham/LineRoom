import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionStatus } from "@/types/database";
import { billingLog } from "@/lib/billing/logger";
import { getIosIapProductId } from "@/lib/billing/apple-iap-env";

/**
 * Persists App Store subscription state for a user after a verified StoreKit 2
 * transaction (device validator or App Store Server Notification).
 */
export async function upsertSubscriptionFromAppleTransaction(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  tx: JWSTransactionDecodedPayload,
): Promise<void> {
  const expectedProduct = getIosIapProductId();
  const productId = tx.productId?.trim();
  if (expectedProduct && productId && productId !== expectedProduct) {
    throw new Error(`Unexpected IAP product id: ${productId}`);
  }

  const original = tx.originalTransactionId?.trim();
  if (!original) {
    throw new Error("Missing originalTransactionId");
  }

  const revoked = Boolean(tx.revocationDate);
  const expMs = typeof tx.expiresDate === "number" ? tx.expiresDate : null;
  const active = !revoked && expMs !== null && expMs > Date.now();
  const status: SubscriptionStatus = active ? "active" : "canceled";
  const periodEnd = expMs ? new Date(expMs).toISOString() : null;

  const { data: prior } = await admin
    .from("subscriptions")
    .select("created_at, email")
    .eq("user_id", userId)
    .maybeSingle();

  const normalizedEmail =
    email?.trim().toLowerCase() ||
    prior?.email?.trim().toLowerCase() ||
    null;
  const now = new Date().toISOString();

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      email: normalizedEmail,
      billing_provider: "app_store",
      app_store_original_transaction_id: original,
      app_store_product_id: productId ?? expectedProduct ?? null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      updated_at: now,
      created_at: prior?.created_at ?? now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    billingLog.error("App Store subscription upsert failed", {
      userId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  billingLog.info("App Store subscription synced", {
    userId,
    originalTransactionId: original,
    status,
    periodEnd,
  });
}
