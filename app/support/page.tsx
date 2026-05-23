import type { Metadata } from "next";
import Link from "next/link";
import { APPLE_STANDARD_EULA_URL } from "@/lib/legal/urls";

export const metadata: Metadata = {
  title: "Support — LineRoom",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-100">Support</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Need help with LineRoom? We&apos;re here for you.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-100">Contact Us</h2>
          <p className="mt-2">
            For questions, issues, or feedback, email us at{" "}
            <a
              href="mailto:support@line-room.com"
              className="text-emerald-500/90 underline"
            >
              support@line-room.com
            </a>
            . We aim to respond within 24 hours.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            Frequently Asked Questions
          </h2>
          <dl className="mt-3 space-y-4">
            <div>
              <dt className="font-medium text-zinc-200">
                What is LineRoom?
              </dt>
              <dd className="mt-1 text-zinc-400">
                LineRoom is a lyrics and poetry workspace that helps songwriters
                draft, revise, and strengthen their work with AI-powered
                line-by-line feedback and conversational critique.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-200">
                How do I cancel my subscription?
              </dt>
              <dd className="mt-1 text-zinc-400">
                If you subscribed on the web, go to your Account page and cancel
                through the billing portal. If you subscribed on iOS, go to
                Settings &gt; your Apple ID &gt; Subscriptions and cancel from
                there.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-200">
                How do I delete my account?
              </dt>
              <dd className="mt-1 text-zinc-400">
                Visit the Account page and select &quot;Delete Account.&quot;
                This permanently removes all your data including songs, drafts,
                and recordings. If you have an active iOS subscription, cancel it
                separately in iOS Settings.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-200">
                Is my writing private?
              </dt>
              <dd className="mt-1 text-zinc-400">
                Yes. Your lyrics and drafts are stored securely and are only
                accessible to your account. Content is sent to AI models solely
                to generate feedback for you. See our{" "}
                <Link
                  href="/privacy"
                  className="text-emerald-500/90 underline"
                >
                  Privacy Policy
                </Link>{" "}
                for full details.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-200">
                I found a bug or something isn&apos;t working.
              </dt>
              <dd className="mt-1 text-zinc-400">
                Please email{" "}
                <a
                  href="mailto:support@line-room.com"
                  className="text-emerald-500/90 underline"
                >
                  support@line-room.com
                </a>{" "}
                with a description of the issue, what device and browser you&apos;re
                using, and any screenshots if possible.
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-500/90 underline">
          Home
        </Link>
        {" · "}
        <Link href="/privacy" className="text-emerald-500/90 underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="text-emerald-500/90 underline">
          Terms of Service
        </Link>
        {" · "}
        <a
          href={APPLE_STANDARD_EULA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-500/90 underline"
        >
          Terms of Use (EULA)
        </a>
      </p>
    </div>
  );
}
