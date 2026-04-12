import { NextResponse } from "next/server";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { billingLog } from "@/lib/billing/logger";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `GET /api/billing/access[?session_id=cs_xxx]`
 *
 * Returns the user's current critique access state. When `session_id` is
 * provided (e.g. from the success page redirect), it first attempts to
 * resolve the subscription directly from the Stripe Checkout Session.
 *
 * This handles the case where the webhook hasn't arrived yet (common in
 * local dev or when webhook delivery is delayed).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id")?.trim();

  if (user && sessionId) {
    await reconcileFromCheckoutSession(sessionId, user.id, user.email ?? null);
  }

  const access = await getCritiqueAccessForUser(supabase, user);
  return NextResponse.json({ access });
}

/**
 * Resolves the subscription from a completed Stripe Checkout Session and
 * upserts it to Supabase. This is a fast path that avoids the broader
 * customer-search reconcile — it goes straight to the source.
 */
async function reconcileFromCheckoutSession(
  sessionId: string,
  userId: string,
  email: string | null,
): Promise<void> {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode !== "subscription" || session.payment_status !== "paid") return;

    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subId) return;

    const stripeSub = await stripe.subscriptions.retrieve(subId);
    const admin = createServiceRoleClient();

    await upsertSubscriptionFromStripe(admin, stripeSub, {
      explicitUserId: userId,
      explicitEmail: email?.trim().toLowerCase(),
      statusOverride: "active",
    });

    billingLog.info("Reconciled from checkout session", { userId, sessionId, stripeSubscriptionId: subId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.warn("Checkout session reconcile failed", { userId, sessionId, error: msg });
  }
}
