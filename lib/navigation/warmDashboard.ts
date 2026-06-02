"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { revalidateDashboardCache } from "@/lib/songs/actions";

const WARM_DEBOUNCE_MS = 1200;

let warmTimer: ReturnType<typeof setTimeout> | null = null;

/** Warm the dashboard RSC payload without busting the client cache. */
export function prefetchDashboard(router: Pick<AppRouterInstance, "prefetch">) {
  router.prefetch("/");
}

/** After autosave, refresh dashboard data in the background for a snappy back navigation. */
export function scheduleDashboardWarm(router: Pick<AppRouterInstance, "prefetch">) {
  if (warmTimer) clearTimeout(warmTimer);
  warmTimer = setTimeout(() => {
    prefetchDashboard(router);
    void revalidateDashboardCache();
  }, WARM_DEBOUNCE_MS);
}
