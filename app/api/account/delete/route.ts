import { NextResponse } from "next/server";
import { fetchSubscriptionForUser } from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { billingLog } from "@/lib/billing/logger";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `POST /api/account/delete`
 *
 * Body: `{ confirmEmail: string }` must match the authenticated user's email.
 * Cancels an active Stripe subscription when present, then deletes the auth user
 * (cascades per your Supabase schema).
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

  const confirm =
    typeof body === "object" && body !== null && "confirmEmail" in body ?
      String((body as { confirmEmail?: unknown }).confirmEmail ?? "")
    : "";

  if (confirm.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match your account email." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const sub = await fetchSubscriptionForUser(supabase, user.id);

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
