import type { Metadata } from "next";
import Link from "next/link";
import { StartProButton } from "@/components/billing/StartProButton";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { TrackOnMount } from "@/components/marketing/TrackOnMount";
import { publicPageMetadata } from "@/lib/seo";
import {
  IOS_APP_STORE_URL,
  PRO_MONTHLY_PRICE_DISPLAY,
  PRO_MONTHLY_PRICE_NOTE,
  isProPricePlaceholder,
} from "@/lib/site-config";

export const metadata: Metadata = publicPageMetadata({
  title: "Pricing — LineRoom",
  description:
    "Free songwriting feedback, or unlimited critiques with LineRoom Pro. See plans and pricing.",
  path: "/pricing",
});

const freePoints = [
  "3 AI critiques, no account needed",
  "Lyrics editor with DRAFT / BRAINSTORM modes",
  "Voice-memo recording",
];

const proPoints = [
  "Unlimited AI critiques",
  "Workshop chat — rhymes, thesaurus, line-level notes",
  "Save pieces in the cloud, sync across devices",
  "Priority generation speed",
];

export default function PricingPage() {
  const pricePlaceholder = isProPricePlaceholder();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <MarketingHeader />
      <TrackOnMount event="pricing_viewed" props={{ source: "pricing_page" }} />
      <header className="mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Pricing
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-300">
          Free songwriting feedback, or unlimited critiques with LineRoom Pro.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Free</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
            $0
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-zinc-300">
            {freePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Link
            href="/lineroom"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Try free
          </Link>
        </article>

        <article className="relative flex flex-col rounded-2xl border border-indigo-500/40 bg-zinc-900/70 p-6">
          <p className="absolute right-4 top-4 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-100">
            Most popular
          </p>
          <h2 className="text-lg font-semibold text-zinc-100">Pro</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
            {PRO_MONTHLY_PRICE_DISPLAY}
            <span className="text-base font-medium text-zinc-400">/month</span>
          </p>
          {pricePlaceholder ?
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
              PLACEHOLDER
            </p>
          : null}
          {PRO_MONTHLY_PRICE_NOTE ?
            <p className="mt-1 text-xs text-zinc-500">{PRO_MONTHLY_PRICE_NOTE}</p>
          : null}
          <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-zinc-300">
            {proPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="mt-8">
            <StartProButton />
            <p className="mt-2 text-center text-xs text-zinc-500">Cancel anytime.</p>
          </div>
        </article>
      </div>

      <section className="mt-14 max-w-2xl" aria-labelledby="pricing-faq-heading">
        <h2 id="pricing-faq-heading" className="text-xl font-semibold text-zinc-100">
          FAQ
        </h2>
        <dl className="mt-6 space-y-6">
          <div>
            <dt className="font-medium text-zinc-100">Is my work private?</dt>
            <dd className="mt-1 text-sm leading-relaxed text-zinc-400">
              Your lyrics are sent to our AI provider only to generate your critique, and your pieces are protected by row-level security. We never sell your lyrics.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-100">Can I cancel anytime?</dt>
            <dd className="mt-1 text-sm leading-relaxed text-zinc-400">
              Yes. Cancel from your Account page or the Stripe customer portal. You keep Pro until the end of your billing period.
            </dd>
          </div>
          {IOS_APP_STORE_URL ?
            <div>
              <dt className="font-medium text-zinc-100">Is there an iOS app?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-400">
                Yes — LineRoom is also on iOS, where Pro is billed through the App Store.{" "}
                <a
                  href={IOS_APP_STORE_URL}
                  className="text-zinc-200 underline underline-offset-2"
                >
                  Get the iOS app
                </a>
                .
              </dd>
            </div>
          : null}
          <div>
            <dt className="font-medium text-zinc-100">Is the feedback really AI?</dt>
            <dd className="mt-1 text-sm leading-relaxed text-zinc-400">
              Yes. LineRoom&apos;s critiques are AI-generated, tuned for songwriting — line-by-line, in the context of the influences and genre you provide. It&apos;s an editor, not a ghostwriter: your words stay yours.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
