"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * On mobile, fixed pane headers should sit below the guest trial banner
 * instead of covering it (`top-0`). Returns the banner height in px (0 on desktop
 * or when the banner is absent).
 */
export function useGuestBannerMobileOffset(
  bannerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): number {
  const [offsetPx, setOffsetPx] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setOffsetPx(0);
      return;
    }
    const el = bannerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      if (!mq.matches) {
        setOffsetPx(0);
        return;
      }
      setOffsetPx(Math.ceil(el.getBoundingClientRect().height));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
    };
  }, [bannerRef, enabled]);

  return offsetPx;
}
