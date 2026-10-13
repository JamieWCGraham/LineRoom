import {
  ANALYTICS_DOMAIN_OR_KEY,
  ANALYTICS_PROVIDER,
  SITE_URL,
} from "@/lib/site-config";

export type AnalyticsEvent =
  | "pricing_viewed"
  | "trial_started"
  | "critique_generated"
  | "trial_limit_reached"
  | "signup_started"
  | "signup_completed"
  | "checkout_started"
  | "pro_purchased";

export type AnalyticsProps = Record<string, string | number>;

const PII_KEY = /email|lyric|password|user.?id|phone|draft|fulltext|token/i;
const EMAILISH = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function analyticsEnabled(): boolean {
  if (ANALYTICS_PROVIDER === "none") return false;
  return ANALYTICS_DOMAIN_OR_KEY.length > 0;
}

/** Drops keys and values that could identify a person or contain lyrics. */
export function sanitizeAnalyticsProps(
  props?: AnalyticsProps,
): AnalyticsProps | undefined {
  if (!props) return undefined;
  const safe: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEY.test(key)) continue;
    if (typeof value === "string" && (EMAILISH.test(value) || value.length > 80)) {
      continue;
    }
    safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

type PlausibleFn = {
  (event: string, options?: { props?: AnalyticsProps }): void;
  q?: unknown[][];
};

declare global {
  interface Window {
    plausible?: PlausibleFn;
    posthog?: { capture?: (event: string, props?: AnalyticsProps) => void };
  }
}

export function track(
  event: AnalyticsEvent,
  props?: AnalyticsProps,
): void | Promise<void> {
  if (!analyticsEnabled()) return;
  const safe = sanitizeAnalyticsProps(props);
  if (typeof window === "undefined") {
    return sendServerEvent(event, safe);
  }
  if (ANALYTICS_PROVIDER === "plausible") {
    const plausible: PlausibleFn =
      window.plausible ??
      function plausibleQueue(...args: unknown[]) {
        const fn = window.plausible as PlausibleFn;
        fn.q = fn.q || [];
        fn.q.push(args);
      };
    window.plausible = window.plausible ?? plausible;
    window.plausible(event, safe ? { props: safe } : undefined);
    return;
  }
  if (ANALYTICS_PROVIDER === "posthog") {
    window.posthog?.capture?.(event, safe);
  }
}

async function sendServerEvent(
  event: AnalyticsEvent,
  props: AnalyticsProps | undefined,
): Promise<void> {
  try {
    if (ANALYTICS_PROVIDER === "plausible") {
      await fetch("https://plausible.io/api/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LineRoom/1.0",
        },
        body: JSON.stringify({
          name: event,
          url: `${SITE_URL}/`,
          domain: ANALYTICS_DOMAIN_OR_KEY,
          ...(props ? { props } : {}),
        }),
      });
      return;
    }
    if (ANALYTICS_PROVIDER === "posthog") {
      await fetch("https://us.i.posthog.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: ANALYTICS_DOMAIN_OR_KEY,
          event,
          distinct_id: "server",
          properties: { ...(props ?? {}), $process_person_profile: false },
        }),
      });
    }
  } catch {
    /* Measurement must never affect signup, billing, or critique. */
  }
}
