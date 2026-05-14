import { NextResponse } from "next/server";
import {
  fetchSubscriptionForUser,
  subscriptionIsPaid,
} from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { billingLog } from "@/lib/billing/logger";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `POST /api/account/delete`
 *
 * Body: `{ confirmEmail: string, acknowledgeAppStoreSub?: boolean }` —
 * `confirmEmail` must match the authenticated user's email.
 *
 * When the user has an active App Store subscription and
 * `acknowledgeAppStoreSub` is not `true`, the endpoint returns 409 with a
 * message instructing the user to cancel via iOS Settings first. The client
 * must re-submit with `acknowledgeAppStoreSub: true` to proceed.
 *
 * Cancels an active Stripe subscription when present, marks App Store
 * subscriptions as canceled in our DB, then deletes the auth user (cascades
 * per your Supabase schema).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const obj =
    typeof body === "object" && body !== null ?
      (body as Record<string, unknown>)
    : {};

  const confirm = String(obj.confirmEmail ?? "");
  const acknowledgeAppStoreSub = obj.acknowledgeAppStoreSub === true;

  if (confirm.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match your account email." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const sub = await fetchSubscriptionForUser(supabase, user.id);

  if (sub?.billing_provider === "app_store" && subscriptionIsPaid(sub)) {
    if (!acknowledgeAppStoreSub) {
      return NextResponse.json(
        {
          error: "active_app_store_subscription",
          message:
            "You have an active App Store subscription. " +
            "Deleting your account will not cancel it — you must cancel " +
            "in Settings > Subscriptions on your iPhone. " +
            "Confirm you understand to proceed.",
        },
        { status: 409 },
      );
    }
    billingLog.info("Account delete proceeding with active App Store sub", {
      userId: user.id,
      originalTxId: sub.app_store_original_transaction_id,
    });
    await admin
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id);
  }

  if (sub?.stripe_subscription_id && sub.billing_provider !== "app_store") {
    try {
      const canceled = await getStripe().subscriptions.cancel(
        sub.stripe_subscription_id,
      );
      await upsertSubscriptionFromStripe(admin, canceled, {
        explicitUserId: user.id,
        statusOverride: "canceled",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      billingLog.error("Stripe cancel before account delete failed", {
        userId: user.id,
        error: msg,
      });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    billingLog.error("Account delete failed", {
      userId: user.id,
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  billingLog.info("Account deleted", { userId: user.id });
  return NextResponse.json({ ok: true });
}
