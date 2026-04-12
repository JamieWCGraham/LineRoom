import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { subscriptionIsPaid } from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";

type ReconcileResult = {
  attempted: boolean;
  hasPaidSubscription: boolean;
};

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export async function reconcileSubscriptionForUser(
  userId: string,
  email?: string | null,
): Promise<ReconcileResult> {
  if (!userId) {
    return { attempted: false, hasPaidSubscription: false };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { attempted: false, hasPaidSubscription: false };
  }

  const { data: row, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[billing] reconcile fetch subscription", error.message);
    return { attempted: false, hasPaidSubscription: false };
  }

  const stripeSubId = row?.stripe_subscription_id?.trim() || null;
  const stripeCustomerId = row?.stripe_customer_id?.trim() || null;

  try {
    const stripe = getStripe();

    if (stripeSubId) {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      await upsertSubscriptionFromStripe(admin, stripeSub, userId);
      return {
        attempted: true,
        hasPaidSubscription: subscriptionIsPaid({
          user_id: userId,
          stripe_customer_id:
            typeof stripeSub.customer === "string" ?
              stripeSub.customer
            : stripeSub.customer.id,
          stripe_subscription_id: stripeSub.id,
          stripe_price_id: stripeSub.items.data[0]?.price?.id ?? null,
          status: stripeSub.status,
          current_period_end:
            stripeSub.current_period_end ?
              new Date(stripeSub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          created_at: "",
          updated_at: "",
        }),
      };
    }

    if (stripeCustomerId) {
      const list = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 1,
      });
      const latest = list.data[0];
      if (!latest) {
        return { attempted: true, hasPaidSubscription: false };
      }
      await upsertSubscriptionFromStripe(admin, latest, userId);
      return {
        attempted: true,
        hasPaidSubscription: subscriptionIsPaid({
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: latest.id,
          stripe_price_id: latest.items.data[0]?.price?.id ?? null,
          status: latest.status,
          current_period_end:
            latest.current_period_end ?
              new Date(latest.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: latest.cancel_at_period_end,
          created_at: "",
          updated_at: "",
        }),
      };
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) {
      const customers = await stripe.customers.list({
        email: normalizedEmail,
        limit: 10,
      });

      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 10,
        });

        const paid = subs.data.find((sub) =>
          sub.status === "active" || sub.status === "trialing",
        );

        if (paid) {
          await upsertSubscriptionFromStripe(admin, paid, userId);
          return {
            attempted: true,
            hasPaidSubscription: true,
          };
        }

        const latest = subs.data[0];
        if (latest) {
          await upsertSubscriptionFromStripe(admin, latest, userId);
          return {
            attempted: true,
            hasPaidSubscription: subscriptionIsPaid({
              user_id: userId,
              stripe_customer_id: customer.id,
              stripe_subscription_id: latest.id,
              stripe_price_id: latest.items.data[0]?.price?.id ?? null,
              status: latest.status,
              current_period_end:
                latest.current_period_end ?
                  new Date(latest.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: latest.cancel_at_period_end,
              created_at: "",
              updated_at: "",
            }),
          };
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[billing] reconcile from stripe", msg);
  }

  return { attempted: false, hasPaidSubscription: false };
}

export function resolveWebhookUserIdFromCheckoutSession(
  session: Pick<Stripe.Checkout.Session, "metadata" | "client_reference_id">,
): string | null {
  const metaUser = session.metadata?.user_id?.trim();
  if (isUuid(metaUser)) return metaUser;

  const clientRef = session.client_reference_id?.trim();
  if (isUuid(clientRef)) return clientRef;

  return null;
}
