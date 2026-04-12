import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/billing/config";
import { fetchSubscriptionForUser } from "@/lib/billing/subscription-row";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json(
      { error: "No billing account on file." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[billing] portal session", e);
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 500 },
    );
  }
}
