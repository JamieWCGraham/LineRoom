import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { resolveWebhookUserIdFromCheckoutSession } from "@/lib/billing/reconcile";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

async function isEventProcessed(
  admin: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("stripe_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

async function markEventProcessed(
  admin: ReturnType<typeof createServiceRoleClient>,
  event: Stripe.Event,
): Promise<void> {
  const { error } = await admin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
  });
  if (error?.code === "23505") return;
  if (error) {
    console.error("[stripe webhook] mark processed", error.message);
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "verify failed";
    console.error("[stripe webhook]", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (await isEventProcessed(admin, event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const subId =
          typeof session.subscription === "string" ?
            session.subscription
          : session.subscription?.id;
        if (!subId) break;
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        const userId = resolveWebhookUserIdFromCheckoutSession(session);
        await upsertSubscriptionFromStripe(admin, stripeSub, userId);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const subId =
          typeof session.subscription === "string" ?
            session.subscription
          : session.subscription?.id;
        if (!subId) break;
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        const userId = resolveWebhookUserIdFromCheckoutSession(session);
        await upsertSubscriptionFromStripe(admin, stripeSub, userId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(admin, stripeSub);
        break;
      }
      default:
        break;
    }
    await markEventProcessed(admin, event);
  } catch (e) {
    console.error("[stripe webhook] handler", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
