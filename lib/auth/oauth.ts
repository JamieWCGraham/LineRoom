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

/** Short-lived cookie set when starting OAuth; read after callback (keeps Supabase redirect allowlist to one URL). */
export const OAUTH_NEXT_COOKIE = "lr_oauth_next";

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
): string {
  const safe = sanitizeAuthNext(next);
  const p = new URLSearchParams({ provider });
  if (safe !== "/") p.set("next", safe);
  return `/auth/oauth?${p.toString()}`;
}

export function buildOAuthSignInOptions(provider: OAuthProviderId) {
  return {
    provider,
    options: {
      redirectTo: oauthCallbackUrl(),
    },
  } as const;
}
