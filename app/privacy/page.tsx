import type { Metadata } from "next";
import Link from "next/link";
import { APPLE_STANDARD_EULA_URL } from "@/lib/legal/urls";
import { PRIVACY_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy — LineRoom",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-100">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Last updated: May 14, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            1. What LineRoom Is
          </h2>
          <p className="mt-2">
            LineRoom is a lyrics and poetry workspace that helps songwriters
            draft, shape, and refine their work with AI-powered critique and
            conversational feedback. LineRoom is operated by Phase Space Studio
            (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            2. Information We Collect
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account information:</strong> email address and
              authentication credentials (via Supabase Auth). If you sign in
              with Google or Apple, we receive the email and display name
              associated with that account.
            </li>
            <li>
              <strong>Content you create:</strong> lyrics, drafts, song
              metadata, and draft audio recordings you choose to save.
            </li>
            <li>
              <strong>AI interactions:</strong> messages you send to the
              Workshop tools and critique requests, which are processed by
              third-party AI providers (see Section 5).
            </li>
            <li>
              <strong>Billing information:</strong> managed by Stripe (web) or
              Apple (iOS in-app purchase). We store subscription status and
              identifiers but do not store payment card details.
            </li>
            <li>
              <strong>Microphone audio:</strong> recorded only when you
              explicitly tap &quot;Record&quot; for draft voice memos. Audio is
              uploaded to private cloud storage tied to your account.
            </li>
            <li>
              <strong>Usage and diagnostics:</strong> we may use Langfuse for
              AI observability (tracing prompt/response quality). Server logs
              may record request metadata such as timestamps and error details.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            3. How We Use Your Information
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>To provide, maintain, and improve LineRoom&apos;s features.</li>
            <li>
              To generate AI-powered critique and chat responses for your
              drafts.
            </li>
            <li>To manage your subscription and billing status.</li>
            <li>
              To evaluate and improve the quality of AI critique outputs
              (aggregated and de-identified).
            </li>
            <li>To respond to support requests or account issues.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            4. Data Storage and Security
          </h2>
          <p className="mt-2">
            Your data is stored in Supabase (hosted on AWS infrastructure) with
            row-level security policies. Draft recordings are stored in private
            Supabase Storage buckets. All data is transmitted over HTTPS.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            5. Third-Party Services
          </h2>
          <p className="mt-2">We share data with the following providers:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>OpenAI / Vercel AI Gateway:</strong> your lyrics and chat
              messages are sent to AI models to generate critique and
              conversational responses. See{" "}
              <a
                href="https://openai.com/privacy"
                className="text-emerald-500/90 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenAI&apos;s privacy policy
              </a>
              .
            </li>
            <li>
              <strong>Supabase:</strong> authentication, database, and file
              storage.
            </li>
            <li>
              <strong>Stripe:</strong> payment processing for web subscribers.
            </li>
            <li>
              <strong>Apple:</strong> in-app purchase processing for iOS
              subscribers.
            </li>
            <li>
              <strong>Langfuse:</strong> optional AI observability and tracing
              (no personal data beyond prompt/response content).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            6. Data Retention and Deletion
          </h2>
          <p className="mt-2">
            You can delete your account at any time from the Account page. This
            permanently removes your authentication record, profile, songs,
            drafts, recordings, and subscription data. If you have an active
            Stripe subscription, it will be cancelled automatically. If you have
            an active App Store subscription, you must cancel it separately in
            iOS Settings &gt; Subscriptions.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            7. Children&apos;s Privacy
          </h2>
          <p className="mt-2">
            LineRoom is not intended for children under 13. We do not knowingly
            collect information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            8. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this policy from time to time. We will notify you of
            material changes by updating the date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">
            9. Contact
          </h2>
          <p className="mt-2">
            For questions about this privacy policy or your data, contact us at{" "}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="text-emerald-500/90 underline"
            >
              {PRIVACY_EMAIL}
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
