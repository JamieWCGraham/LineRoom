import { headers } from "next/headers";

/** Matches `billingClientPlatformHeaders` from the Capacitor iOS WebView. */
export async function isIosCapacitorBillingRequest(): Promise<boolean> {
  const h = await headers();
  return h.get("x-lineroom-client-platform") === "ios-capacitor";
}
