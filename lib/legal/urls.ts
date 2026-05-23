/** Apple Licensed Application Standard EULA (App Store default). */
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/** Terms of Use (EULA) for App Store subscription disclosure — Apple standard EULA. */
export function getTermsOfUseEulaUrl(): string {
  return APPLE_STANDARD_EULA_URL;
}

/** @deprecated Use {@link getTermsOfUseEulaUrl} for subscription EULA; kept for imports. */
export function getTermsOfUseUrl(): string {
  return getTermsOfUseEulaUrl();
}

/** LineRoom service terms (usage, billing, content) — separate from app license EULA. */
export function getServiceTermsUrl(): string {
  const origin = getPublicAppOrigin();
  return origin ? `${origin}/terms` : "/terms";
}

/** Client-safe canonical origin for in-app legal pages (privacy, service terms). */
export function getPublicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getPrivacyPolicyUrl(): string {
  const origin = getPublicAppOrigin();
  return origin ? `${origin}/privacy` : "/privacy";
}
