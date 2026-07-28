"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Warm routes users open from the signed-in dashboard (desktop + mobile). */
export function PrefetchDashboardRoutes({ includeEvals }: { includeEvals: boolean }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/account");
    router.prefetch("/lineroom");
    if (includeEvals) {
      router.prefetch("/evals");
      router.prefetch("/admin");
    }
  }, [router, includeEvals]);
  return null;
}

/** Prefetch song editor RSC payloads for visible dashboard rows. */
export function PrefetchDashboardSongs({ songIds }: { songIds: string[] }) {
  const router = useRouter();
  const idsKey = songIds.join(",");
  useEffect(() => {
    for (const id of songIds) {
      router.prefetch(`/song/${id}`);
    }
  }, [router, idsKey, songIds]);
  return null;
}

/** From account, back links go to dashboard and local LineRoom. */
export function PrefetchAccountNav() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/lineroom");
  }, [router]);
  return null;
}

/** Landing (logged out / guest): auth + try entry points. */
export function PrefetchPublicLandingAuth() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/signup");
    router.prefetch("/lineroom");
  }, [router]);
  return null;
}

/** Login / signup layout: post-auth destinations. */
export function PrefetchAuthLayoutRoutes() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/login");
    router.prefetch("/signup");
  }, [router]);
  return null;
}
