"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export function useMobileToolbarInset(ref: RefObject<HTMLElement | null>): number {
  const [insetPx, setInsetPx] = useState(52);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      if (!mq.matches) return;
      setInsetPx(el.getBoundingClientRect().height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  return insetPx;
}
