import { NextResponse } from "next/server";
import { deleteUserAndData } from "@/lib/account/deleteUserData";
import { billingLog } from "@/lib/billing/logger";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * `POST /api/admin/users/delete`
 *
 * Body: `{ targetUserId: string, confirmEmail: string }`
 * Requires evals access. Cannot delete your own account (use Account page).
 */
export async function POST(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

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

  const targetUserId = String(obj.targetUserId ?? "").trim();
  const confirmEmail = String(obj.confirmEmail ?? "").trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing target user id." }, { status: 400 });
  }

  if (targetUserId === gate.userId) {
    return NextResponse.json(
      {
        error:
          "You cannot delete your own account here. Use the Account page instead.",
      },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 500 },
    );
  }

  const { data: targetAuth, error: authErr } =
    await admin.auth.admin.getUserById(targetUserId);
  if (authErr || !targetAuth.user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const targetEmail = targetAuth.user.email?.trim() ?? "";
  if (!targetEmail) {
    return NextResponse.json(
      { error: "Target user has no email; use the delete-user CLI instead." },
      { status: 400 },
    );
  }

  if (confirmEmail.toLowerCase() !== targetEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match the selected user." },
      { status: 400 },
    );
  }

  billingLog.info("Admin user delete requested", {
    adminEmail: gate.email,
    adminUserId: gate.userId,
    targetUserId,
    targetEmail,
  });

  const result = await deleteUserAndData(admin, {
    userId: targetUserId,
    userEmail: targetEmail,
    acknowledgeAppStoreSub: true,
  });

  if (!result.ok) {
    if (result.code === "active_app_store_subscription") {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  billingLog.info("Admin user delete completed", {
    adminEmail: gate.email,
    targetUserId,
  });

  return NextResponse.json({ ok: true });
}
