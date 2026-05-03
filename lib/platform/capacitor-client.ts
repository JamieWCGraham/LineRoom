"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { userAgentHasLineroomIosShellToken } from "@/lib/platform/lineroom-native-shell";

type WebKitWindow = Window & {
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: { postMessage?: (msg: unknown) => void } } };
};

/**
 * Same signal @capacitor/core uses for iOS (`getPlatformId`).
 */
function hasCapacitorIosBridge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as WebKitWindow;
    if (w.androidBridge) return false;
    return w.webkit?.messageHandlers?.bridge != null;
  } catch {
    return false;
  }
}

/**
 * True in the installed LineRoom iOS app (Capacitor WKWebView).
 *
 * Order: (1) UA token from `ios.appendUserAgent` in capacitor.config — set at
 * native build/sync and reliable for remote URL shells; (2) Capacitor bridge;
 * (3) @capacitor/core APIs.
 */
export function isIosCapacitorApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (userAgentHasLineroomIosShellToken(navigator.userAgent)) return true;
    if (hasCapacitorIosBridge()) return true;
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/**
 * Before paint + short follow-up reads for late bridge / hydration edge cases.
 */
export function useIosCapacitorAppLayout(): boolean {
  const [ios, setIos] = useState(false);

  useLayoutEffect(() => {
    if (isIosCapacitorApp()) setIos(true);
  }, []);

  useEffect(() => {
    if (isIosCapacitorApp()) {
      setIos(true);
      return;
    }
    const delays = [0, 16, 50, 120, 300, 800];
    const ids = delays.map((ms) =>
      window.setTimeout(() => {
        if (isIosCapacitorApp()) setIos(true);
      }, ms),
    );
    return () => ids.forEach((id) => clearTimeout(id));
  }, []);

  return ios;
}

/** Sent with billing fetches so API routes can reject Stripe inside the iOS shell. */
export function billingClientPlatformHeaders(): HeadersInit {
  return isIosCapacitorApp() ? { "x-lineroom-client-platform": "ios-capacitor" } : {};
}
