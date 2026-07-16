"use client";

import Link from "next/link";

export function GuestTryBanner() {
  return (
    <div className="shrink-0 border-b border-sky-900/40 bg-sky-950/40 px-4 py-2 text-center text-sm text-sky-100/90">
      <span>Trial Mode of LineRoom: </span>
      <Link
        href="/signup"
        className="font-medium text-sky-50 underline underline-offset-2 hover:text-white"
      >
        Sign up
      </Link>
      <span> to save across devices</span>
    </div>
  );
}
