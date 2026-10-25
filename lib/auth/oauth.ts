export type OAuthProviderId = "google" | "apple";

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function oauthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

/**
 * Custom URL scheme for Capacitor iOS ASWebAuthenticationSession return.
 * Must be registered in Info.plist CFBundleURLSchemes and in Supabase
 * Authentication → URL Configuration redirect allowlist.
 */
export const NATIVE_OAUTH_SCHEME = "lineroom";

/** Deep-link callback caught by ASWebAuthenticationSession (not Safari). */
export function nativeOAuthCallbackUrl(): string {
  return `${NATIVE_OAUTH_SCHEME}://auth/callback`;
}

/** Short-lived cookie set when starting OAuth; read after callback (keeps Supabase redirect allowlist to one URL). */
export const OAUTH_NEXT_COOKIE = "lr_oauth_next";

/**
 * Google button on login & signup.
 * Set NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=true after Google is configured in Supabase.
 */
export const oauthGoogleEnabled =
  process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === "true";

/**
 * Apple button on login & signup (kept off until Apple is configured in Supabase).
 * Set NEXT_PUBLIC_OAUTH_APPLE_ENABLED=true when ready.
 */
export const oauthAppleEnabled =
  process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === "true";

/** True when any OAuth provider button should render on login/signup. */
export const oauthSignInUiEnabled = oauthGoogleEnabled || oauthAppleEnabled;

/**
 * Only same-origin relative paths; default "/". Blocks open redirects.
 */
export function sanitizeAuthNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  if (t.includes("\\") || t.includes(":")) return "/";
  return t;
}

/**
 * Post-email-confirm destination. Recovery OTP or an explicit safe
 * `next=/reset-password` (from resetPasswordForEmail redirectTo) → reset form.
 */
export function resolveEmailConfirmRedirect(opts: {
  type: string | null | undefined;
  next: string | null | undefined;
}): string {
  const safeNext = sanitizeAuthNext(opts.next);
  if (opts.type === "recovery" || safeNext === "/reset-password") {
    return "/reset-password";
  }
  return "/";
}

/** Email confirmation + password-recovery callback used by Auth emails. */
export function authConfirmUrl(next?: string): string {
  const base = `${getSiteUrl()}/auth/confirm`;
  if (!next) return base;
  const safe = sanitizeAuthNext(next);
  if (safe === "/") return base;
  return `${base}?next=${encodeURIComponent(safe)}`;
}

export function parseOAuthProvider(
  raw: string | null | undefined,
): OAuthProviderId | null {
  if (raw === "google" || raw === "apple") return raw;
  return null;
}

/** Relative URL to start OAuth (same host — works in Capacitor remote shell). */
export function oauthStartHref(
  provider: OAuthProviderId,
  next: string = "/",
  opts?: { native?: boolean },
): string {
  const safe = sanitizeAuthNext(next);
  const p = new URLSearchParams({ provider });
  if (safe !== "/") p.set("next", safe);
  if (opts?.native) p.set("native", "1");
  return `/auth/oauth?${p.toString()}`;
}

export function buildOAuthSignInOptions(
  provider: OAuthProviderId,
  opts?: { native?: boolean },
) {
  return {
    provider,
    options: {
      redirectTo: opts?.native ? nativeOAuthCallbackUrl() : oauthCallbackUrl(),
    },
  } as const;
}
