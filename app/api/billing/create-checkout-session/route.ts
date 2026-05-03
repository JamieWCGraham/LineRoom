import { NextResponse } from "next/server";
import { getAppUrl, getStripePriceIdMonthly } from "@/lib/billing/config";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { getOrCreateStripeCustomer } from "@/lib/billing/stripe-customer";
import { billingLog } from "@/lib/billing/logger";
import { isIosCapacitorBillingRequest } from "@/lib/billing/ios-request";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `POST /api/billing/create-checkout-session`
 *
 * Creates a Stripe Checkout session for the authenticated user to subscribe
 * to the Pro plan. The session embeds the Supabase `user_id` in both
 * `client_reference_id` and `metadata` so the webhook can link the resulting
 * subscription back to the correct user.
 *
 * Guards:
 *  - 401 if unauthenticated
 *  - 503 if `STRIPE_PRICE_ID_MONTHLY` is not set
 *  - Early return if the user is bypassed or already subscribed
 */
export async function POST() {
  if (await isIosCapacitorBillingRequest()) {
    return NextResponse.json(
      {
        error:
          "Stripe checkout is not available in the iOS app. Use LineRoom Pro via in-app purchase.",
      },
      { status: 403 },
    );
  }

  const priceId = getStripePriceIdMonthly();
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured (STRIPE_PRICE_ID_MONTHLY)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getCritiqueAccessForUser(supabase, user);

  if (access.isBypassed) {
    return NextResponse.json({
      message: "Your account has full access; checkout is not required.",
      bypassed: true,
    });
  }
  if (access.hasActiveSubscription) {
    return NextResponse.json({
      message: "You already have an active subscription.",
      subscribed: true,
    });
  }

  const admin = createServiceRoleClient();
  const email = user.email ?? "";

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer(admin, user.id, email);
  } catch {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  const appUrl = getAppUrl();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      client_reference_id: user.id,
      metadata: { user_id: user.id, email },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: false,
    });

    if (!session.url) {
      billingLog.error("Stripe returned no checkout URL", { userId: user.id });
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    billingLog.info("Checkout session created", {
      userId: user.id,
      sessionId: session.id,
      customerId,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Failed to create checkout session", { userId: user.id, error: msg });
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
