import Link from "next/link";
import { AppBrandLogo } from "@/components/app-brand";

/** Softer outline — nav destinations, distinct from Login. */
const navButtonClass =
  "inline-flex min-h-11 items-center rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900/70 hover:text-zinc-200";

/** Compact text links for narrow headers (landing mobile). */
const navTextClass =
  "inline-flex min-h-10 items-center px-1.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100";

const outlineButtonClass =
  "inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80";

const solidButtonClass =
  "inline-flex min-h-11 items-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white";

export function MarketingHeader({ hideNavOnMobile = false }: { hideNavOnMobile?: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <AppBrandLogo size={48} className="h-9 w-9 sm:h-11 sm:w-11" priority />
        <span className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-3xl">
          LineRoom
        </span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-3">
        <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-3">
          <Link
            href="/pricing"
            className={hideNavOnMobile ? `${navTextClass} sm:hidden` : "hidden"}
          >
            Pricing
          </Link>
          <Link
            href="/features"
            className={hideNavOnMobile ? `${navTextClass} sm:hidden` : "hidden"}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={hideNavOnMobile ? `hidden ${navButtonClass} sm:inline-flex` : navButtonClass}
          >
            Pricing
          </Link>
          <Link
            href="/features"
            className={hideNavOnMobile ? `hidden ${navButtonClass} sm:inline-flex` : navButtonClass}
          >
            Features
          </Link>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login" prefetch className={outlineButtonClass}>
            Login
          </Link>
          <Link href="/signup" prefetch className={solidButtonClass}>
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
