import Link from "next/link";
import { IOS_APP_STORE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

const linkClass =
  "inline-flex min-h-11 items-center text-zinc-300 underline-offset-2 hover:text-zinc-50 hover:underline";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950 px-4 py-6 text-sm sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 sm:gap-8">
        <nav aria-label="Product">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Product
          </p>
          <ul className="mt-2 space-y-0.5 sm:space-y-1">
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
          <ul className="mt-2 space-y-0.5 sm:space-y-1">
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
        <nav aria-label="Contact" className="col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Contact
          </p>
          <ul className="mt-2 flex flex-col gap-0.5 sm:space-y-1 sm:gap-0">
            <li>
              <Link href="/contact" className={linkClass}>
                Contact us
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=LineRoom%20support`}
                className={linkClass}
              >
                {SUPPORT_EMAIL}
              </a>
            </li>
            {IOS_APP_STORE_URL ?
              <li>
                <a
                  href={IOS_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Download on the App Store
                </a>
              </li>
            : null}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-6 w-full max-w-6xl text-xs text-zinc-500 sm:mt-8">
        © {year} LineRoom. All rights reserved.
      </p>
    </footer>
  );
}
