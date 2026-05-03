import { NextResponse } from "next/server";
import { fetchSubscriptionForUser } from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { billingLog } from "@/lib/billing/logger";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `POST /api/billing/cancel-subscription`
 *
 * Cancels the authenticated user's subscription **immediately** and issues a
 * full refund for the most recent invoice payment. Updates the Supabase row
 * to `status='canceled'` without waiting for the webhook.
 *
 * The webhook will also fire `customer.subscription.deleted` and write the
 * same status — that's fine (idempotent upsert).
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
  if (sub?.billing_provider === "app_store") {
    return NextResponse.json(
      {
        error:
          "This subscription is billed through the App Store. Open Settings → Apple ID → Subscriptions to cancel.",
      },
      { status: 400 },
    );
  }
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription found." }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    const canceled = await stripe.subscriptions.cancel(sub.stripe_subscription_id);

    billingLog.info("Subscription canceled immediately", {
      userId: user.id,
      stripeSubscriptionId: canceled.id,
    });

    // Update Supabase immediately so the UI reflects the change without
    // waiting for the webhook.
    const admin = createServiceRoleClient();
    await upsertSubscriptionFromStripe(admin, canceled, {
      explicitUserId: user.id,
      statusOverride: "canceled",
    });

    // Refund the most recent invoice payment.
    const latestInvoiceId =
      typeof canceled.latest_invoice === "string"
        ? canceled.latest_invoice
        : canceled.latest_invoice?.id;

    let refunded = false;

    if (latestInvoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(latestInvoiceId);
        const paymentIntentId =
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id;

        if (paymentIntentId) {
          await stripe.refunds.create({ payment_intent: paymentIntentId });
          refunded = true;
          billingLog.info("Refund issued for latest invoice", {
            userId: user.id,
            invoiceId: latestInvoiceId,
            paymentIntentId,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        billingLog.error("Refund failed", {
          userId: user.id,
          invoiceId: latestInvoiceId,
          error: msg,
        });
      }
    }

    return NextResponse.json({
      canceled: true,
      refunded,
      message: refunded
        ? "Your subscription has been canceled and a refund has been issued."
        : "Your subscription has been canceled.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Subscription cancellation failed", { userId: user.id, error: msg });
    return NextResponse.json({ error: "Could not cancel subscription." }, { status: 500 });
  }
}
