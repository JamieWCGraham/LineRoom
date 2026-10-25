"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { IOS_APP_STORE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

const linkClass =
  "inline-flex min-h-11 items-center text-zinc-300 underline-offset-2 hover:text-zinc-50 hover:underline";

function FooterNav() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 sm:gap-8">
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
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950 text-sm">
      {/* Mobile: collapsed chrome — expand for Product / Legal / Contact */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <p className="text-xs text-zinc-500">© {year} LineRoom</p>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide links" : "More"}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        {open ?
          <div
            id={panelId}
            className="border-t border-zinc-800/80 px-5 pb-5 pt-4"
          >
            <FooterNav />
          </div>
        : null}
      </div>

      {/* Desktop: full footer */}
      <div className="mx-auto hidden w-full max-w-6xl px-6 py-8 sm:block">
        <FooterNav />
        <p className="mt-8 text-xs text-zinc-500">
          © {year} LineRoom. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
