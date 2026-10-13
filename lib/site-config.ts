/**
 * Public marketing copy. Prices, store links, and analytics IDs are filled in
 * here or via env — never guessed in page components.
 */

export const SITE_URL = "https://line-room.com";
export const SUPPORT_EMAIL = "support@line-room.com";

// TODO (Jamie): fill in before launch — do not guess.
export const PRO_MONTHLY_PRICE_DISPLAY = "$X"; // e.g. "$12" — must match Stripe
export const PRO_MONTHLY_PRICE_NOTE = ""; // e.g. "USD, billed monthly" — if applicable

// TODO (Jamie): fill in, or leave "" and iOS links stay hidden.
export const IOS_APP_STORE_URL = "";

// TODO (Jamie): fill in once chosen. Domain/key comes from env only.
export const ANALYTICS_PROVIDER: "plausible" | "posthog" | "none" =
  resolveAnalyticsProvider();

export const ANALYTICS_DOMAIN_OR_KEY =
  process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN_OR_KEY?.trim() ?? "";

export const OG_TITLE = "LineRoom — AI feedback that makes your lyrics better";
export const OG_DESCRIPTION =
  "Paste your lyrics. Get line-by-line critique in seconds. Free to try, no signup.";
export const OG_IMAGE_PATH = "/og-image.png";

// TODO (Jamie): replace with 3 real quotes from real users (name + role/city).
// The section renders NOTHING while this array is empty. Do not ship invented quotes.
export const TESTIMONIALS: { quote: string; name: string; detail: string }[] =
  [];

/** True when the display price is still the unset sentinel. */
export function isProPricePlaceholder(): boolean {
  const value = PRO_MONTHLY_PRICE_DISPLAY.trim();
  return value === "" || value === "$X";
}

function resolveAnalyticsProvider(): "plausible" | "posthog" | "none" {
  const raw = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER?.trim().toLowerCase();
  if (raw === "posthog" || raw === "none" || raw === "plausible") return raw;
  return "plausible";
}
