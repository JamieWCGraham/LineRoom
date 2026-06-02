"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
/** Song editor layout: start prefetching `/` before the editor shell mounts. */
export function PrefetchDashboardFromEditor() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/");
  }, [router]);
  return null;
}
