type PricingPhaseLike = {
  price?: string;
  billingPeriod?: string;
  paymentMode?: string;
  recurrenceMode?: string;
};

export type IosSubscriptionDisplay = {
  /** Subscription / publication title from App Store Connect */
  title: string;
  /** Localized price charged each billing period (most prominent in UI) */
  billedPrice: string;
  /** Human-readable renewal period, e.g. "1 month" */
  periodLabel: string;
  /** What the subscriber receives each period */
  serviceDescription: string;
  /** Trial or introductory pricing — subordinate to billed amount */
  subordinateLines: string[];
};

const DEFAULT_TITLE = "LineRoom Pro";
const DEFAULT_SERVICE =
  "Unlimited AI-powered lyric critique, chat feedback, and draft tools for songwriters.";

export {
  getPrivacyPolicyUrl,
  getTermsOfUseEulaUrl,
  getTermsOfUseUrl,
} from "@/lib/legal/urls";

/**
 * ISO 8601 duration (e.g. P1M, P1Y) → readable period for subscription disclosure.
 */
export function formatIso8601BillingPeriod(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/i.exec(iso.trim());
  if (!m) return null;
  const years = Number(m[1] || 0);
  const months = Number(m[2] || 0);
  const weeks = Number(m[3] || 0);
  const days = Number(m[4] || 0);
  const parts: string[] = [];
  if (years) parts.push(pluralize(years, "year"));
  if (months) parts.push(pluralize(months, "month"));
  if (weeks) parts.push(pluralize(weeks, "week"));
  if (days) parts.push(pluralize(days, "day"));
  return parts.length ? parts.join(" ") : null;
}

function pluralize(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function phaseLabel(phase: PricingPhaseLike): string | null {
  const period = formatIso8601BillingPeriod(phase.billingPeriod);
  if (phase.paymentMode === "FreeTrial") {
    return period ? `Free trial: ${period}` : "Free trial";
  }
  if (phase.paymentMode === "UpFront") {
    return period ?
        `Introductory price ${phase.price} for ${period}`
      : `Introductory price ${phase.price}`;
  }
  return null;
}

function pickBilledPhase(phases: PricingPhaseLike[]): PricingPhaseLike | undefined {
  if (!phases.length) return undefined;
  const recurring = phases.find(
    (p) =>
      p.paymentMode === "PayAsYouGo" &&
      p.recurrenceMode === "INFINITE_RECURRING",
  );
  if (recurring) return recurring;
  const payAsYouGo = phases.find((p) => p.paymentMode === "PayAsYouGo");
  if (payAsYouGo) return payAsYouGo;
  const notTrial = phases.find((p) => p.paymentMode !== "FreeTrial");
  return notTrial ?? phases[phases.length - 1];
}

export function buildIosSubscriptionDisplay(
  product: { title?: string; description?: string },
  offer: { pricingPhases?: PricingPhaseLike[] },
): IosSubscriptionDisplay {
  const phases = offer.pricingPhases ?? [];
  const billedPhase = pickBilledPhase(phases);
  const billedPrice = billedPhase?.price?.trim() || "—";
  const periodLabel =
    formatIso8601BillingPeriod(billedPhase?.billingPeriod) ?? "per billing period";

  const subordinateLines: string[] = [];
  for (const phase of phases) {
    if (phase === billedPhase) continue;
    const label = phaseLabel(phase);
    if (label) subordinateLines.push(label);
  }

  const title = product.title?.trim() || DEFAULT_TITLE;
  const description = product.description?.trim();
  const serviceDescription =
    description && description.length > 0 ? description : DEFAULT_SERVICE;

  return {
    title,
    billedPrice,
    periodLabel,
    serviceDescription,
    subordinateLines,
  };
}
