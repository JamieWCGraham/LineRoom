import { NextResponse } from "next/server";
import {
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import {
  getAppleAppStoreNumericId,
  getAppleBundleId,
  getAppleIapVerifierEnvironment,
  loadAppleRootCertificates,
} from "@/lib/billing/apple-iap-env";
import { verifyStoreKit2Transaction } from "@/lib/billing/apple-jws-verify";
import { upsertSubscriptionFromAppleTransaction } from "@/lib/billing/upsert-app-store-subscription";
import { billingLog } from "@/lib/billing/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function buildNotificationVerifier(environment: Environment): SignedDataVerifier {
  const roots = loadAppleRootCertificates();
  if (!roots.length) {
    throw new Error("Missing Apple root certificates");
  }
  const bundleId = getAppleBundleId();
  const appAppleId =
    environment === Environment.PRODUCTION ?
      getAppleAppStoreNumericId()
    : undefined;
  const enableOnlineChecks =
    process.env.APPLE_IAP_ONLINE_CERT_CHECKS?.trim() !== "false";
  return new SignedDataVerifier(
    roots,
    enableOnlineChecks,
    environment,
    bundleId,
    appAppleId,
  );
}

async function decodeNotification(signedPayload: string) {
  const primary = getAppleIapVerifierEnvironment();
  const secondary =
    primary === Environment.PRODUCTION ? Environment.SANDBOX : (
      Environment.PRODUCTION
    );
  let lastErr: unknown;
  for (const env of [primary, secondary]) {
    try {
      const verifier = buildNotificationVerifier(env);
      return await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * App Store Server Notifications v2 endpoint.
 * Configure the URL in App Store Connect → Apps → your app → App Information →
 * App Store Server Notifications → Production / Sandbox.
 */
export async function POST(req: Request) {
  const secret = process.env.APP_STORE_NOTIFICATION_AUTH_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization")?.trim();
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signedPayload =
    typeof body === "object" && body !== null && "signedPayload" in body ?
      String((body as { signedPayload?: unknown }).signedPayload ?? "")
    : "";

  if (!signedPayload) {
    return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await decodeNotification(signedPayload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "decode failed";
    billingLog.error("ASN: notification verify failed", { error: msg });
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const notificationUuid = decoded.notificationUUID?.trim();
  const signedTx = decoded.data?.signedTransactionInfo;
  if (!signedTx) {
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceRoleClient();

  if (notificationUuid) {
    const { error: insErr } = await admin
      .from("app_store_notification_events")
      .insert({
        notification_uuid: notificationUuid,
        notification_type: String(decoded.notificationType ?? ""),
      });
    if (insErr?.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    if (insErr) {
      billingLog.error("ASN: idempotency insert failed", { error: insErr.message });
    }
  }

  let tx;
  try {
    tx = await verifyStoreKit2Transaction(signedTx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tx verify failed";
    billingLog.error("ASN: transaction verify failed", { error: msg });
    return NextResponse.json({ ok: true });
  }

  const token = tx.appAccountToken?.trim().toLowerCase();
  let userId: string | null =
    token && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    ) ?
      token
    : null;

  if (!userId && tx.originalTransactionId) {
    const { data: row } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("app_store_original_transaction_id", tx.originalTransactionId)
      .maybeSingle();
    userId = row?.user_id ?? null;
  }

  if (!userId) {
    billingLog.error("ASN: could not resolve user", {
      originalTransactionId: tx.originalTransactionId,
    });
    return NextResponse.json({ ok: true });
  }

  const { data: authUser, error: authErr } =
    await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser.user) {
    billingLog.error("ASN: user lookup failed", { userId, error: authErr?.message });
    return NextResponse.json({ ok: true });
  }

  try {
    await upsertSubscriptionFromAppleTransaction(
      admin,
      userId,
      authUser.user.email,
      tx,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upsert failed";
    billingLog.error("ASN: upsert failed", { userId, error: msg });
  }

  return NextResponse.json({ ok: true });
}
