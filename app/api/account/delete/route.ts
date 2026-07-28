import { NextResponse } from "next/server";
import { deleteUserAndData } from "@/lib/account/deleteUserData";
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
 * Cancels Stripe billing, removes draft recordings from storage, deletes the
 * Stripe customer when applicable, then deletes the auth user (DB cascades).
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
  const result = await deleteUserAndData(admin, {
    userId: user.id,
    userEmail: user.email,
    acknowledgeAppStoreSub,
  });

  if (!result.ok) {
    if (result.code === "active_app_store_subscription") {
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
        },
        { status: result.status },
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
