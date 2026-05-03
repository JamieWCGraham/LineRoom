import { headers } from "next/headers";
import { userAgentHasLineroomIosShellToken } from "@/lib/platform/lineroom-native-shell";

/**
 * True when the request comes from the LineRoom iOS Capacitor shell.
 * Uses the client header and/or the iOS-only `appendUserAgent` token (see
 * `capacitor.config.ts`) so Stripe routes stay blocked even if JS detection fails.
 */
export async function isIosCapacitorBillingRequest(): Promise<boolean> {
  const h = await headers();
  if (h.get("x-lineroom-client-platform") === "ios-capacitor") return true;
  return userAgentHasLineroomIosShellToken(h.get("user-agent"));
}
