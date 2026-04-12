import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { resolveWebhookUserIdFromCheckoutSession } from "@/lib/billing/reconcile";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

async function logSubscriptionWrite(
  admin: ReturnType<typeof createServiceRoleClient>,
  details: {
    eventType: string;
    eventId: string;
    stripeSubscriptionId: string;
    resolvedUserId?: string | null;
    statusOverride?: string;
  },
): Promise<void> {
  const { data: row, error } = await admin
    .from("subscriptions")
    .select("user_id, status, stripe_subscription_id")
    .eq("stripe_subscription_id", details.stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[stripe webhook] log lookup failed", {
      eventType: details.eventType,
      eventId: details.eventId,
      stripeSubscriptionId: details.stripeSubscriptionId,
      resolvedUserId: details.resolvedUserId ?? null,
      statusOverride: details.statusOverride ?? null,
      error: error.message,
    });
    return;
  }

  console.log("[stripe webhook] subscription sync", {
    eventType: details.eventType,
    eventId: details.eventId,
    stripeSubscriptionId: details.stripeSubscriptionId,
    resolvedUserId: details.resolvedUserId ?? null,
    statusOverride: details.statusOverride ?? null,
    rowUserId: row?.user_id ?? null,
    rowStatus: row?.status ?? null,
    rowSubscriptionId: row?.stripe_subscription_id ?? null,
  });
}

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
        const email = session.customer_details?.email ?? session.customer_email ?? null;
        const statusOverride =
          session.payment_status === "paid" ? "active" : undefined;
        await upsertSubscriptionFromStripe(admin, stripeSub, userId, email, {
          statusOverride,
        });
        await logSubscriptionWrite(admin, {
          eventType: event.type,
          eventId: event.id,
          stripeSubscriptionId: stripeSub.id,
          resolvedUserId: userId,
          statusOverride,
        });
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
        const email = session.customer_details?.email ?? session.customer_email ?? null;
        await upsertSubscriptionFromStripe(admin, stripeSub, userId, email, {
          statusOverride: "active",
        });
        await logSubscriptionWrite(admin, {
          eventType: event.type,
          eventId: event.id,
          stripeSubscriptionId: stripeSub.id,
          resolvedUserId: userId,
          statusOverride: "active",
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(admin, stripeSub, undefined, undefined, {
          statusOverride: undefined,
          allowCustomerLookup: false,
        });
        await logSubscriptionWrite(admin, {
          eventType: event.type,
          eventId: event.id,
          stripeSubscriptionId: stripeSub.id,
          resolvedUserId: null,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const { data: prior } = await admin
          .from("subscriptions")
          .select("user_id, stripe_subscription_id")
          .eq("stripe_subscription_id", stripeSub.id)
          .maybeSingle();
        if (!prior?.user_id) {
          // Ignore stale deletes for older subscriptions that no longer map to
          // the user's current subscription row.
          console.log("[stripe webhook] ignored stale delete", {
            eventType: event.type,
            eventId: event.id,
            stripeSubscriptionId: stripeSub.id,
          });
          break;
        }
        await upsertSubscriptionFromStripe(admin, stripeSub, prior.user_id, undefined, {
          statusOverride: "canceled",
          allowCustomerLookup: false,
        });
        await logSubscriptionWrite(admin, {
          eventType: event.type,
          eventId: event.id,
          stripeSubscriptionId: stripeSub.id,
          resolvedUserId: prior.user_id,
          statusOverride: "canceled",
        });
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
