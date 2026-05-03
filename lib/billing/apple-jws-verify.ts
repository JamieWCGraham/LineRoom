import {
  Environment,
  SignedDataVerifier,
  VerificationException,
} from "@apple/app-store-server-library";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import {
  getAppleAppStoreNumericId,
  getAppleBundleId,
  getAppleIapVerifierEnvironment,
  loadAppleRootCertificates,
} from "@/lib/billing/apple-iap-env";
import { billingLog } from "@/lib/billing/logger";

function buildVerifier(environment: Environment): SignedDataVerifier {
  const roots = loadAppleRootCertificates();
  if (!roots.length) {
    throw new Error(
      "Missing Apple root certificates. Add certs/apple/*.cer (see MOBILE_DEPLOYMENT.md).",
    );
  }
  const bundleId = getAppleBundleId();
  const appAppleId =
    environment === Environment.PRODUCTION ?
      getAppleAppStoreNumericId()
    : undefined;
  if (environment === Environment.PRODUCTION && appAppleId === undefined) {
    billingLog.error(
      "APPLE_APP_STORE_APP_ID is required for production JWS verification",
    );
  }
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

/**
 * Verifies a StoreKit 2 `signedTransactionInfo` JWS from the device or ASN.
 * Tries the configured environment first, then the other (covers mixed
 * sandbox/TestFlight vs production server env).
 */
export async function verifyStoreKit2Transaction(
  signedTransactionInfo: string,
): Promise<JWSTransactionDecodedPayload> {
  const primary = getAppleIapVerifierEnvironment();
  const secondary =
    primary === Environment.PRODUCTION ? Environment.SANDBOX : (
      Environment.PRODUCTION
    );

  for (const env of [primary, secondary]) {
    try {
      const verifier = buildVerifier(env);
      return await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    } catch (e) {
      if (e instanceof VerificationException) {
        billingLog.error("Apple JWS verification failed", {
          environment: env,
          status: e.status,
          message: e.message,
        });
        continue;
      }
      throw e;
    }
  }

  throw new Error("Could not verify Apple transaction JWS");
}
