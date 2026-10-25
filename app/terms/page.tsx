import type { Metadata } from "next";
import Link from "next/link";
import { APPLE_STANDARD_EULA_URL } from "@/lib/legal/urls";
import { SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service — LineRoom",
  description: "LineRoom Terms of Service for web and iOS.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-100">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Last updated: May 14, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            1. Acceptance of Terms
          </h2>
          <p className="mt-2">
            By creating an account or using LineRoom, you agree to these Terms
            of Service. If you do not agree, do not use the service. LineRoom is
            operated by Phase Space Studio (&quot;we&quot;, &quot;us&quot;,
            &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            2. Description of Service
          </h2>
          <p className="mt-2">
            LineRoom is a lyrics and poetry workspace that provides AI-powered
            critique, conversational feedback, and draft management tools for
            songwriters. The service is available via web browser and as an iOS
            application.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            3. Accounts
          </h2>
          <p className="mt-2">
            You must provide a valid email address to create an account. You are
            responsible for maintaining the security of your account credentials.
            You may delete your account at any time from the Account settings
            page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            4. Your Content
          </h2>
          <p className="mt-2">
            You retain full ownership of all lyrics, drafts, recordings, and
            other content you create in LineRoom. By using the service, you
            grant us a limited license to process your content solely for the
            purpose of providing the service (e.g., sending lyrics to AI models
            for critique). We do not claim any intellectual property rights over
            your content.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            5. AI-Generated Feedback
          </h2>
          <p className="mt-2">
            Critique, chat responses, and other AI-generated feedback are
            provided for creative assistance only. They are not professional
            advice and should not be treated as authoritative assessments of
            artistic merit. AI outputs may be inaccurate, incomplete, or
            reflect biases in the underlying models.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            6. Subscriptions and Billing
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Free tier:</strong> limited critique generations per
              account.
            </li>
            <li>
              <strong>LineRoom Pro (web):</strong> billed monthly via Stripe.
              You may cancel at any time from the Account page or Stripe
              customer portal.
            </li>
            <li>
              <strong>LineRoom Pro (iOS):</strong> billed as an auto-renewable
              subscription via Apple&apos;s App Store. Payment is charged to
              your Apple ID account. The subscription renews automatically
              unless cancelled at least 24 hours before the end of the current
              period. Manage or cancel in iOS Settings &gt; Subscriptions.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            7. Acceptable Use
          </h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Use the service for any unlawful purpose or to violate any laws.
            </li>
            <li>
              Attempt to gain unauthorized access to the service or its related
              systems.
            </li>
            <li>
              Interfere with or disrupt the service or servers or networks
              connected to it.
            </li>
            <li>
              Use automated means to access the service beyond its intended
              interfaces.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            8. Limitation of Liability
          </h2>
          <p className="mt-2">
            LineRoom is provided &quot;as is&quot; without warranties of any
            kind. To the maximum extent permitted by law, we are not liable for
            any indirect, incidental, special, or consequential damages arising
            from your use of the service, including but not limited to loss of
            content, data, or creative work.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            9. Termination
          </h2>
          <p className="mt-2">
            We may suspend or terminate your access to LineRoom at our
            discretion if you violate these terms. You may terminate your
            account at any time by deleting it from the Account settings page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            10. Changes to These Terms
          </h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the
            service after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            11. Contact
          </h2>
          <p className="mt-2">
            For questions about these terms, contact us at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-emerald-500/90 underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-500/90 underline">
          Home
        </Link>
        {" · "}
        <Link href="/contact" className="text-emerald-500/90 underline">
          Contact
        </Link>
        {" · "}
        <Link href="/privacy" className="text-emerald-500/90 underline">
          Privacy Policy
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
