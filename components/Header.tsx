"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_TAGLINE, AppBrandLogo } from "@/components/app-brand";

export function Header(props: { showDashboardLink?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!props.showDashboardLink) return;
    router.prefetch("/");
  }, [props.showDashboardLink, router]);

  return (
    <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-100">
            <span className="hidden sm:block">
              <AppBrandLogo size={36} className="h-9 w-9" />
            </span>
            LineRoom
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">{APP_TAGLINE}</p>
        </div>
        {props.showDashboardLink ?
          <Link
            href="/"
            prefetch
            className="shrink-0 rounded-md border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-sm font-medium text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-700/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Back to Dashboard
          </Link>
        : null}
      </div>
    </header>
  );
}
