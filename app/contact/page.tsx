import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { publicPageMetadata } from "@/lib/seo";
import { PRIVACY_EMAIL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = publicPageMetadata({
  title: "Contact — LineRoom",
  description:
    "Contact LineRoom support or privacy. Email support@line-room.com or privacy@line-room.com.",
  path: "/contact",
});

const mailClass = "text-emerald-500/90 underline";

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <MarketingHeader />
      <header className="mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Contact
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          LineRoom is operated by Phase Space Studio. Reach us by email — we aim
          to respond within 24 hours.
        </p>
      </header>

      <div className="mt-10 max-w-2xl space-y-8 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-100">Support</h2>
          <p className="mt-2">
            Questions, billing, bugs, or feedback:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=LineRoom%20support`}
              className={mailClass}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">Privacy</h2>
          <p className="mt-2">
            Privacy policy or data requests:{" "}
            <a
              href={`mailto:${PRIVACY_EMAIL}?subject=LineRoom%20privacy`}
              className={mailClass}
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100">More help</h2>
          <p className="mt-2">
            See{" "}
            <Link href="/support" className={mailClass}>
              Support &amp; FAQ
            </Link>
            ,{" "}
            <Link href="/terms" className={mailClass}>
              Terms of Use
            </Link>
            , and{" "}
            <Link href="/privacy" className={mailClass}>
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
