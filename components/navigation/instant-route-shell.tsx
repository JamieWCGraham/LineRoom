"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { SongEditorSkeleton } from "@/components/lineroom/song-editor-skeleton";

function AccountSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] max-lg:pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] sm:px-6 lg:py-8">
      <div className="rounded-[28px] border border-zinc-700/50 bg-zinc-900/85 p-6">
        <div className="mx-auto h-6 w-24 animate-pulse rounded bg-zinc-800/70" />
        <div className="mx-auto mt-5 h-20 w-20 animate-pulse rounded-full bg-zinc-800/80" />
        <div className="mx-auto mt-4 h-8 w-48 animate-pulse rounded bg-zinc-800/70" />
      </div>
      <div className="mt-6 space-y-5">
        <div className="h-40 animate-pulse rounded-2xl border border-zinc-700/60 bg-zinc-900/80" />
        <div className="h-32 animate-pulse rounded-2xl border border-zinc-700/60 bg-zinc-900/80" />
      </div>
    </div>
  );
}

function shellForHref(href: string) {
  if (href === "/" || href.startsWith("/?")) return <DashboardSkeleton />;
  if (href.startsWith("/account")) return <AccountSkeleton />;
  if (href.startsWith("/song/")) return <SongEditorSkeleton />;
  return null;
}

function isInternalNavLink(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  if (anchor.origin !== window.location.origin) return null;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  const path = anchor.pathname + anchor.search;
  if (path === window.location.pathname + window.location.search) return null;
  return path;
}

/**
 * Shows the destination route outline the moment an in-app link is clicked,
 * including when a prefetched route would otherwise swap without a loading shell.
 */
export function InstantRouteShell() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      const href = isInternalNavLink(event.target);
      if (!href || !shellForHref(href)) return;
      setPendingHref(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pendingHref) return null;

  const shell = shellForHref(pendingHref);
  if (!shell) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-zinc-950"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading page"
    >
      {shell}
    </div>
  );
}
