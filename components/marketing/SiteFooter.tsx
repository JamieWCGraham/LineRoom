import Link from "next/link";
import { IOS_APP_STORE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

const linkClass =
  "inline-flex min-h-11 items-center text-zinc-300 underline-offset-2 hover:text-zinc-50 hover:underline";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950 px-4 py-8 text-sm">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 sm:grid-cols-3">
        <nav aria-label="Product">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Product
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/pricing" className={linkClass}>
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/features" className={linkClass}>
                Features
              </Link>
            </li>
            <li>
              <Link href="/lineroom" className={linkClass}>
                Try free
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Legal
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/terms" className={linkClass}>
                Terms of Use
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                Privacy Policy
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Contact
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
                {SUPPORT_EMAIL}
              </a>
            </li>
            {IOS_APP_STORE_URL ?
              <li>
                <a href={IOS_APP_STORE_URL} className={linkClass}>
                  iOS app
                </a>
              </li>
            : null}
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 w-full max-w-6xl text-xs text-zinc-500">
        © {year} LineRoom. All rights reserved.
      </p>
    </footer>
  );
}
