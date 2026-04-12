import { getSiteUrl } from "@/lib/auth/oauth";

export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw || getSiteUrl()).replace(/\/$/, "");
}

export function getFreeCritiqueQuota(): number {
  const raw = process.env.FREE_CRITIQUE_QUOTA;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return 5;
  return n;
}

export function getBillingBypassEmails(): Set<string> {
  const raw = process.env.BILLING_BYPASS_EMAILS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

export function isBillingBypassed(email: string | null | undefined): boolean {
  if (!email) return false;
  return getBillingBypassEmails().has(email.trim().toLowerCase());
}

export function getStripePriceIdMonthly(): string | null {
  const id = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
  return id || null;
}
