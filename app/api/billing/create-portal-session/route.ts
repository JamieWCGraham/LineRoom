import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/billing/config";
import { fetchSubscriptionForUser } from "@/lib/billing/subscription-row";
import { billingLog } from "@/lib/billing/logger";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

/**
 * `POST /api/billing/create-portal-session`
 *
 * Opens a Stripe Customer Portal session so the user can manage or cancel
 * their subscription. When the user cancels through the portal, Stripe fires
 * `customer.subscription.updated` (cancel_at_period_end) and eventually
 * `customer.subscription.deleted`, both of which are handled by the webhook
 * to update the Supabase row.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await fetchSubscriptionForUser(supabase, user.id);
  const customerId = sub?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account on file." }, { status: 400 });
  }

  const appUrl = getAppUrl();

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/account?portal_return=1`,
    });

    billingLog.info("Portal session created", { userId: user.id, customerId });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Failed to create portal session", { userId: user.id, error: msg });
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
