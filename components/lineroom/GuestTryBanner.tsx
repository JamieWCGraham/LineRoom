"use client";

import Link from "next/link";
import { forwardRef } from "react";

export const GuestTryBanner = forwardRef<HTMLDivElement>(
  function GuestTryBanner(_props, ref) {
    return (
      <div
        ref={ref}
        className="shrink-0 border-b border-sky-900/40 bg-sky-950/40 px-4 py-2 text-center text-sm text-sky-100/90 max-lg:pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <span>Trial Mode of LineRoom: Workshop is for signed-up users. </span>
        <Link
          href="/signup"
          className="font-medium text-sky-50 underline underline-offset-2 hover:text-white"
        >
          Sign up
        </Link>
        <span> to unlock it and save across devices</span>
      </div>
    );
  },
);
