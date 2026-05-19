"use client";

import { useEffect, useRef } from "react";
import {
  clearChunkReloadAttempt,
  handleChunkLoadFailure,
  reloadOnceForStaleChunks,
} from "@/lib/navigation/chunkLoadRecovery";

type Props = {
  /** Build id from the HTML that booted this tab (see `getAppBuildId`). */
  initialBuildId: string;
};

/**
 * Recovers from stale Next.js/webpack chunks after deploy or long backgrounding.
 * See https://github.com/vercel/next.js/issues/78122
 */
export function ChunkLoadRecovery({ initialBuildId }: Props) {
  const bootBuildIdRef = useRef(initialBuildId);

  useEffect(() => {
    bootBuildIdRef.current = initialBuildId;
  }, [initialBuildId]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      handleChunkLoadFailure(event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      handleChunkLoadFailure(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const clearTimer = window.setTimeout(clearChunkReloadAttempt, 60_000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(clearTimer);
    };
  }, []);

  useEffect(() => {
    if (initialBuildId === "development") return;

    let cancelled = false;

    const checkBuildId = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/app-build-id", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { buildId?: string };
        const live = typeof data.buildId === "string" ? data.buildId : null;
        if (!live || live === bootBuildIdRef.current) return;
        reloadOnceForStaleChunks();
      } catch {
        /* offline or transient — ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkBuildId();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void checkBuildId();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [initialBuildId]);

  return null;
}
