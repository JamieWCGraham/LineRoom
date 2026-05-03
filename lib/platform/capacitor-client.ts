"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

type WebKitWindow = Window & {
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: { postMessage?: (msg: unknown) => void } } };
};

/**
 * Same signal @capacitor/core uses for iOS (`getPlatformId`).
 * Prefer this over `Capacitor.isNativePlatform()` alone — the bridge is present
 * in the Capacitor WKWebView before/without relying on the JS global being fully wired.
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

export function isIosCapacitorApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (hasCapacitorIosBridge()) return true;
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/**
 * iOS shell detection before paint, plus short follow-up reads so we still flip
 * to IAP if the native bridge appears slightly after first layout (remote URL loads).
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
