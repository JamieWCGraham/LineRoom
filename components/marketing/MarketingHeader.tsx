import Link from "next/link";
import { AppBrandLogo } from "@/components/app-brand";

const navLinkClass =
  "inline-flex min-h-11 items-center text-sm font-medium text-zinc-300 transition hover:text-zinc-50";

export function MarketingHeader({ hideNavOnMobile = false }: { hideNavOnMobile?: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Link href="/" className="flex items-center gap-2 sm:gap-2.5">
        <AppBrandLogo size={48} className="h-10 w-10 sm:h-11 sm:w-11" priority />
        <span className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
          LineRoom
        </span>
      </Link>
      <nav
        aria-label="Primary"
        className={`${hideNavOnMobile ? "hidden sm:flex" : "flex"} items-center gap-4`}
      >
        <Link href="/pricing" className={navLinkClass}>
          Pricing
        </Link>
        <Link href="/features" className={navLinkClass}>
          Features
        </Link>
      </nav>
      <div className="hidden gap-3 sm:flex">
        <Link
          href="/login"
          prefetch
          className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
        >
          Login
        </Link>
        <Link
          href="/signup"
          prefetch
          className="inline-flex min-h-11 items-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white"
        >
          Sign up
        </Link>
      </div>
    </header>
  );
}
