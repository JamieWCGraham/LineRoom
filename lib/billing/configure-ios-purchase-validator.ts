"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * API origin for IAP validator calls. Prefer env so Capacitor remote shells
 * always hit the deployed host even if `window.location` is unusual during boot.
 */
function billingApiOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return fromEnv || window.location.origin;
}

type ValidatorPayload = Record<string, unknown>;

/**
 * Wires `capacitor-plugin-cdv-purchase` receipt validation to our Next route
 * using `fetch` + Bearer token. Native WebViews often omit cookies on XHR;
 * the plugin’s default XHR validator then gets 401 from Supabase cookie auth.
 */
export function configureIosPurchasePluginValidator(store: {
  validator: unknown;
}): void {
  store.validator = (body: object, callback: (payload: ValidatorPayload) => void) => {
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const url = `${billingApiOrigin()}/api/billing/ios/plugin-validator`;
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch(url, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(body),
        });
        let payload: ValidatorPayload;
        try {
          payload = (await res.json()) as ValidatorPayload;
        } catch {
          payload = {
            ok: false,
            message: `Validator returned non-JSON (HTTP ${res.status})`,
          };
        }
        callback(payload);
      } catch (e) {
        callback({
          ok: false,
          message: e instanceof Error ? e.message : "Network error",
        });
      }
    })();
  };
}
