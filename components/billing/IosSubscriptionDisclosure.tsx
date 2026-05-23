"use client";

import Link from "next/link";
import type { IosSubscriptionDisplay } from "@/lib/billing/ios-subscription-disclosure";
import {
  getPrivacyPolicyUrl,
  getTermsOfUseEulaUrl,
} from "@/lib/legal/urls";

type Props = {
  display: IosSubscriptionDisplay | null;
  loading?: boolean;
  /** Labeled rows for App Store subscription disclosure (Guideline 3.1.2). */
  showRequiredLabels?: boolean;
};

export function IosSubscriptionDisclosure({
  display,
  loading,
  showRequiredLabels = false,
}: Props) {
  const eulaUrl = getTermsOfUseEulaUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  const title = display?.title ?? "LineRoom Pro";
  const periodLabel = display?.periodLabel ?? null;
  const billedPrice = display?.billedPrice ?? null;

  const lengthText =
    periodLabel ?
      `${periodLabel} (auto-renewing)`
    : loading ?
      "Loading from the App Store…"
    : "—";

  const priceText =
    billedPrice && periodLabel ?
      `${billedPrice} per ${periodLabel}`
    : loading ?
      "Loading from the App Store…"
    : "—";

  return (
    <div className="space-y-4" aria-labelledby="ios-subscription-disclosure-title">
      {showRequiredLabels ?
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Subscription
            </dt>
            <dd
              id="ios-subscription-disclosure-title"
              className="mt-1 font-semibold text-zinc-100"
            >
              {title}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Length
            </dt>
            <dd className="mt-1 text-zinc-300">{lengthText}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Price
            </dt>
            <dd className="mt-1">
              {billedPrice && periodLabel ?
                <p className="text-3xl font-bold tracking-tight text-zinc-50">
                  {billedPrice}
                  <span className="ml-1.5 text-base font-normal text-zinc-400">
                    / {periodLabel}
                  </span>
                </p>
              : (
                <p className="text-zinc-400">{priceText}</p>
              )}
            </dd>
          </div>
        </dl>
      : (
        <div>
          <h3
            id="ios-subscription-disclosure-title"
            className="text-sm font-semibold text-zinc-100"
          >
            {title}
          </h3>
          {loading && !display ?
            <p className="mt-2 text-xs text-zinc-500">
              Loading subscription details from the App Store…
            </p>
          : null}
          {display ?
            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">
              {display.billedPrice}
              <span className="ml-1.5 text-base font-normal text-zinc-400">
                / {display.periodLabel}
              </span>
            </p>
          : null}
        </div>
      )}

      {display?.subordinateLines && display.subordinateLines.length > 0 ?
        <ul className="space-y-0.5 text-xs text-zinc-500">
          {display.subordinateLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      : null}

      {display ?
        <>
          <p className="text-sm leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-300">Includes: </span>
            {display.serviceDescription}
          </p>
          <p className="text-xs leading-relaxed text-zinc-500">
            Auto-renewable subscription. Payment is charged to your Apple ID at
            confirmation of purchase. Renews every {display.periodLabel} unless
            you cancel at least 24 hours before the end of the current period.
            Manage or cancel in Settings → Subscriptions.
          </p>
        </>
      : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        <a
          href={eulaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-500/90 underline underline-offset-2"
        >
          Terms of Use (EULA)
        </a>
        {" · "}
        <Link
          href={privacyUrl}
          className="text-emerald-500/90 underline underline-offset-2"
        >
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
