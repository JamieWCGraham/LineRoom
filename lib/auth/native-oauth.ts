"use client";

import { InAppBrowser } from "@capgo/capacitor-inappbrowser";
import {
  nativeOAuthCallbackUrl,
  oauthStartHref,
  type OAuthProviderId,
} from "@/lib/auth/oauth";

export type NativeOAuthResult =
  | { ok: true }
  | { ok: false; canceled: boolean };

/**
 * Capacitor iOS: start server OAuth (PKCE cookies on WebView), open IdP in
 * ASWebAuthenticationSession, then hand the code to /auth/callback in-app.
 */
export async function runNativeOAuth(
  provider: OAuthProviderId,
  next: string = "/",
): Promise<NativeOAuthResult> {
  const startPath = oauthStartHref(provider, next, { native: true });
  const startRes = await fetch(startPath, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!startRes.ok) {
    return { ok: false, canceled: false };
  }

  const body = (await startRes.json()) as { url?: string; error?: string };
  if (!body.url) {
    return { ok: false, canceled: false };
  }

  const redirectUri = nativeOAuthCallbackUrl();
  let redirectedUri: string;
  try {
    const result = await InAppBrowser.openSecureWindow({
      authEndpoint: body.url,
      redirectUri,
    });
    redirectedUri = result.redirectedUri;
  } catch {
    // User dismissed the sheet or the plugin rejected (e.g. cancel).
    return { ok: false, canceled: true };
  }

  if (!redirectedUri) {
    return { ok: false, canceled: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(redirectedUri);
  } catch {
    return { ok: false, canceled: false };
  }

  const code = parsed.searchParams.get("code");
  if (!code) {
    return { ok: false, canceled: false };
  }

  const callback = new URLSearchParams({ code });
  const state = parsed.searchParams.get("state");
  if (state) callback.set("state", state);

  window.location.assign(`/auth/callback?${callback.toString()}`);
  return { ok: true };
}
