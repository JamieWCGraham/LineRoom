import { NextResponse } from "next/server";
import { verifyStoreKit2Transaction } from "@/lib/billing/apple-jws-verify";
import { getIosIapProductId } from "@/lib/billing/apple-iap-env";
import { fetchSubscriptionForUser, subscriptionIsPaid } from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromAppleTransaction } from "@/lib/billing/upsert-app-store-subscription";
import { billingLog } from "@/lib/billing/logger";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type AppleSk2Body = { type: "apple-sk2"; jwsRepresentation: string };

/** `capacitor-plugin-cdv-purchase` adds this on validator POST bodies. */
function applicationUsernameFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const extra = (body as { additionalData?: unknown }).additionalData;
  if (!extra || typeof extra !== "object") return null;
  const u = (extra as { applicationUsername?: unknown }).applicationUsername;
  if (typeof u !== "string") return null;
  const t = u.trim();
  return t.length ? t.toLowerCase() : null;
}

function extractSk2Jws(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const tx = (body as { transaction?: unknown }).transaction;
  if (!tx || typeof tx !== "object") return null;
  const t = tx as AppleSk2Body;
  if (t.type === "apple-sk2" && typeof t.jwsRepresentation === "string") {
    return t.jwsRepresentation;
  }
  return null;
}

/** HTTP 200 + `ok: false` matches receipt-validator conventions for the purchase plugin. */
function pluginError(message: string, code: number, httpStatus = 200): NextResponse {
  return NextResponse.json(
    { ok: false as const, status: httpStatus, code, message },
    { status: httpStatus },
  );
}

function pluginSuccess(data: {
  id: string;
  collection: Array<{
    id: string;
    platform: string;
    transactionId?: string;
    purchaseId?: string;
    purchaseDate?: number;
    expiryDate?: number;
    isExpired: boolean;
    isAcknowledged?: boolean;
  }>;
  transaction: { type: "apple-sk2" };
}): NextResponse {
  return NextResponse.json({
    ok: true as const,
    data: {
      ...data,
      latest_receipt: true,
      date: new Date().toISOString(),
    },
  });
}

/**
 * Receipt validator for `capacitor-plugin-cdv-purchase` (StoreKit 2).
 * POST JSON body includes `transaction: { type: 'apple-sk2', jwsRepresentation }`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return pluginError("Invalid JSON", 16);
  }

  const jws = extractSk2Jws(body);
  if (!jws) {
    return pluginError("Missing apple-sk2 transaction", 14);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const expectedProduct = getIosIapProductId();
  if (!expectedProduct) {
    billingLog.error("IOS_IAP_PRODUCT_ID is not configured");
    return pluginError("IAP is not configured on the server.", 1);
  }

  let decoded;
  try {
    decoded = await verifyStoreKit2Transaction(jws);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "verify failed";
    billingLog.error("IAP JWS verify failed", { userId: user.id, error: msg });
    return pluginError("Verification failed", 15);
  }

  const expectedBundle =
    process.env.APPLE_BUNDLE_ID?.trim() || "com.phasespace.lineroom";
  if (decoded.bundleId && decoded.bundleId !== expectedBundle) {
    return pluginError("Bundle id mismatch", 15);
  }

  const uid = user.id.trim().toLowerCase();
  const token = decoded.appAccountToken?.trim().toLowerCase() ?? "";
  const fromPlugin = applicationUsernameFromBody(body);

  const tokenMatches = token.length > 0 && token === uid;
  const usernameMatches = fromPlugin === uid;
  if (token.length > 0 && !tokenMatches) {
    billingLog.error("IAP appAccountToken mismatch", { userId: user.id });
    return pluginError("App account token mismatch", 15);
  }
  if (token.length === 0 && fromPlugin && !usernameMatches) {
    billingLog.error("IAP applicationUsername mismatch", { userId: user.id });
    return pluginError("App account token mismatch", 15);
  }
  if (token.length === 0 && !fromPlugin) {
    billingLog.warn("IAP transaction has no appAccountToken or applicationUsername; binding to session user", {
      userId: user.id,
    });
  }

  const sub = await fetchSubscriptionForUser(supabase, user.id);
  if (sub?.billing_provider === "stripe" && subscriptionIsPaid(sub)) {
    return pluginError(
      "You already have an active web subscription. Manage billing on the web.",
      15,
    );
  }

  try {
    const admin = createServiceRoleClient();
    await upsertSubscriptionFromAppleTransaction(
      admin,
      user.id,
      user.email,
      decoded,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upsert failed";
    billingLog.error("IAP upsert failed", { userId: user.id, error: msg });
    return pluginError(msg, 15);
  }

  const productId = decoded.productId ?? expectedProduct;
  const expMs =
    typeof decoded.expiresDate === "number" ? decoded.expiresDate : 0;
  const purchaseMs =
    typeof decoded.purchaseDate === "number" ? decoded.purchaseDate : undefined;

  return pluginSuccess({
    id: productId,
    transaction: { type: "apple-sk2" },
    collection: [
      {
        id: productId,
        platform: "ios-appstore",
        transactionId: decoded.transactionId,
        purchaseId: decoded.originalTransactionId,
        purchaseDate: purchaseMs,
        expiryDate: expMs || undefined,
        isExpired: !expMs || expMs <= Date.now(),
        isAcknowledged: false,
      },
    ],
  });
}
