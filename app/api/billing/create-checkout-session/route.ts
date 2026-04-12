import { NextResponse } from "next/server";
import { getAppUrl, getStripePriceIdMonthly } from "@/lib/billing/config";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { getOrCreateStripeCustomer } from "@/lib/billing/stripe-customer";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST() {
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
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }

  const appUrl = getAppUrl();
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        email,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
      allow_promotion_codes: false,
    });

    const url = session.url;
    if (!url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[billing] checkout session", e);
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 },
    );
  }
}
