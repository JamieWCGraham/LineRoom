import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { billingLog } from "@/lib/billing/logger";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

// ── Utilities ───────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveUserIdFromSession(
  session: Pick<Stripe.Checkout.Session, "metadata" | "client_reference_id">,
): string | null {
  const meta = session.metadata?.user_id?.trim();
  if (meta && UUID_RE.test(meta)) return meta;

  const ref = session.client_reference_id?.trim();
  if (ref && UUID_RE.test(ref)) return ref;

  return null;
}

function extractSubscriptionId(sub: string | Stripe.Subscription | null): string | null {
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

// ── Idempotency ─────────────────────────────────────────────

type Admin = ReturnType<typeof createServiceRoleClient>;

async function isEventProcessed(admin: Admin, eventId: string): Promise<boolean> {
  const { data } = await admin
    .from("stripe_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

async function markEventProcessed(admin: Admin, event: Stripe.Event): Promise<void> {
  const { error } = await admin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
  });
  // 23505 = unique_violation — already recorded by a concurrent request
  if (error && error.code !== "23505") {
    billingLog.error("Failed to record processed event", {
      eventId: event.id,
      error: error.message,
    });
  }
}

// ── Event handlers ──────────────────────────────────────────

/**
 * Handles a completed (or async-payment-succeeded) checkout session.
 *
 * Retrieves the full Stripe Subscription, resolves the Supabase user from
 * session metadata, and upserts with `status='active'` when the payment has
 * been confirmed.
 */
async function handleCheckoutCompleted(admin: Admin, event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "subscription") return;

  const subId = extractSubscriptionId(session.subscription);
  if (!subId) return;

  const stripeSub = await getStripe().subscriptions.retrieve(subId);
  const userId = resolveUserIdFromSession(session);
  const email = session.customer_details?.email ?? session.customer_email ?? null;

  await upsertSubscriptionFromStripe(admin, stripeSub, {
    explicitUserId: userId,
    explicitEmail: email,
    statusOverride: session.payment_status === "paid" ? "active" : undefined,
  });
}

/**
 * Handles subscription create/update lifecycle events.
 *
 * Uses the Stripe subscription's own status directly (no override).
 * Customer-lookup fallback is disabled because the subscription should
 * already be linked to a user row from checkout.
 */
async function handleSubscriptionChange(admin: Admin, event: Stripe.Event): Promise<void> {
  const stripeSub = event.data.object as Stripe.Subscription;

  await upsertSubscriptionFromStripe(admin, stripeSub, {
    allowCustomerLookup: false,
  });
}

/**
 * Handles subscription deletion (final cancellation or expiry).
 *
 * Looks up the owning user by `stripe_subscription_id` and forces
 * `status='canceled'`. If the subscription isn't linked to any user row
 * the event is logged and skipped — it may belong to an older subscription
 * that was replaced.
 */
async function handleSubscriptionDeleted(admin: Admin, event: Stripe.Event): Promise<void> {
  const stripeSub = event.data.object as Stripe.Subscription;

  const { data: prior } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSub.id)
    .maybeSingle();

  if (!prior?.user_id) {
    billingLog.warn("Ignored delete for unlinked subscription", {
      eventId: event.id,
      stripeSubscriptionId: stripeSub.id,
    });
    return;
  }

  await upsertSubscriptionFromStripe(admin, stripeSub, {
    explicitUserId: prior.user_id,
    statusOverride: "canceled",
    allowCustomerLookup: false,
  });
}

// ── Handler dispatch table ──────────────────────────────────

const EVENT_HANDLERS: Record<string, (admin: Admin, event: Stripe.Event) => Promise<void>> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "checkout.session.async_payment_succeeded": handleCheckoutCompleted,
  "customer.subscription.created": handleSubscriptionChange,
  "customer.subscription.updated": handleSubscriptionChange,
  "customer.subscription.deleted": handleSubscriptionDeleted,
};

// ── Route ───────────────────────────────────────────────────

/**
 * `POST /api/stripe/webhook`
 *
 * Receives Stripe webhook events, verifies the signature, deduplicates, and
 * updates the Supabase `subscriptions` row to reflect the latest Stripe state.
 *
 * **This endpoint is the single source of truth for subscription status.**
 * All subscription state changes flow through here — checkout completion sets
 * `status='active'`, and cancellation/deletion sets `status='canceled'`.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    billingLog.error("STRIPE_WEBHOOK_SECRET is not configured");
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
    const msg = e instanceof Error ? e.message : "signature verification failed";
    billingLog.error("Webhook signature verification failed", { error: msg });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  if (await isEventProcessed(admin, event.id)) {
    billingLog.info("Duplicate event skipped", { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const handler = EVENT_HANDLERS[event.type];
  if (!handler) {
    await markEventProcessed(admin, event);
    return NextResponse.json({ received: true });
  }

  try {
    await handler(admin, event);
    await markEventProcessed(admin, event);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Webhook handler failed", { eventId: event.id, type: event.type, error: msg });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  billingLog.info("Webhook processed", { eventId: event.id, type: event.type });
  return NextResponse.json({ received: true });
}
