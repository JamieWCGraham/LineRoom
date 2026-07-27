"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { GuestWorkflowTourStep } from "@/lib/onboarding/guestWorkflowTour";
import { GUEST_WORKFLOW_TOUR_TARGETS } from "@/lib/onboarding/guestWorkflowTour";

type Props = {
  open: boolean;
  step: GuestWorkflowTourStep;
  onNext: () => void;
  onBack: () => void;
  onDismiss: () => void;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PADDING = 8;
const CARD_GAP = 12;
const CARD_WIDTH = 320;

function targetSelector(step: GuestWorkflowTourStep): string {
  const id =
    step === 1 ?
      GUEST_WORKFLOW_TOUR_TARGETS.draft
    : GUEST_WORKFLOW_TOUR_TARGETS.generateCritique;
  return `[data-tour-target="${id}"]`;
}

function measureTarget(step: GuestWorkflowTourStep): Rect | null {
  const el = document.querySelector(targetSelector(step));
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function GuestWorkflowTour({
  open,
  step,
  onNext,
  onBack,
  onDismiss,
}: Props) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [isNarrow, setIsNarrow] = useState(false);

  const refresh = useCallback(() => {
    setIsNarrow(window.matchMedia("(max-width: 1023px)").matches);
    setRect(measureTarget(step));
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    let cancelled = false;
    let attempts = 0;

    const tick = () => {
      if (cancelled) return;
      refresh();
      attempts += 1;
      // After mobile pane switch, target may mount a frame later.
      if (attempts < 8 && !measureTarget(step)) {
        requestAnimationFrame(tick);
      }
    };

    tick();

    const onResize = () => refresh();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    const ro = new ResizeObserver(() => refresh());
    ro.observe(document.documentElement);
    const target = document.querySelector(targetSelector(step));
    if (target instanceof HTMLElement) ro.observe(target);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      ro.disconnect();
    };
  }, [open, step, refresh]);

  useLayoutEffect(() => {
    if (!open || !rect) return;
    const card = cardRef.current;
    const cardH = card?.offsetHeight ?? 160;
    const cardW = Math.min(CARD_WIDTH, window.innerWidth - 24);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tabBarReserve = isNarrow ? 72 : 0;

    if (isNarrow) {
      // Prefer above the target so we don't cover the Generate button / draft.
      let top = rect.top - cardH - CARD_GAP;
      if (top < 12) {
        top = clamp(
          rect.top + rect.height + CARD_GAP,
          12,
          vh - cardH - 12 - tabBarReserve,
        );
      }
      setCardPos({
        top: clamp(top, 12, vh - cardH - 12 - tabBarReserve),
        left: (vw - cardW) / 2,
      });
      return;
    }

    let top = rect.top + rect.height + CARD_GAP;
    let left = clamp(rect.left, 12, vw - cardW - 12);

    if (top + cardH > vh - 12) {
      top = rect.top - cardH - CARD_GAP;
    }
    if (top < 12) {
      top = clamp(rect.top + 12, 12, vh - cardH - 12);
      left = clamp(rect.left + rect.width + CARD_GAP, 12, vw - cardW - 12);
      if (left + cardW > vw - 12) {
        left = clamp(rect.left - cardW - CARD_GAP, 12, vw - cardW - 12);
      }
    }

    setCardPos({ top, left });
  }, [open, rect, isNarrow, step]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't dismiss while typing/pasting in the draft.
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "TEXTAREA" ||
          active.tagName === "INPUT" ||
          active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onDismiss();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const hole = rect ?? {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  };

  const dismissOutside = (e: MouseEvent) => {
    e.preventDefault();
    onDismiss();
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[190]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Spotlight cutout via box-shadow on a hole element */}
      <div
        aria-hidden
        className="absolute rounded-xl transition-[top,left,width,height] duration-200 ease-out"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.72)",
        }}
      />
      {/*
        Dimmed regions catch clicks to dismiss; the hole has no overlay so the
        draft/generate target stays interactive (type, paste, click).
      */}
      <button
        type="button"
        aria-label="Dismiss tour"
        className="pointer-events-auto absolute left-0 right-0 top-0 cursor-default bg-transparent"
        style={{ height: Math.max(0, hole.top) }}
        onClick={dismissOutside}
      />
      <button
        type="button"
        aria-label="Dismiss tour"
        className="pointer-events-auto absolute left-0 right-0 bottom-0 cursor-default bg-transparent"
        style={{ top: hole.top + hole.height }}
        onClick={dismissOutside}
      />
      <button
        type="button"
        aria-label="Dismiss tour"
        className="pointer-events-auto absolute left-0 cursor-default bg-transparent"
        style={{
          top: hole.top,
          height: hole.height,
          width: Math.max(0, hole.left),
        }}
        onClick={dismissOutside}
      />
      <button
        type="button"
        aria-label="Dismiss tour"
        className="pointer-events-auto absolute right-0 cursor-default bg-transparent"
        style={{
          top: hole.top,
          height: hole.height,
          left: hole.left + hole.width,
        }}
        onClick={dismissOutside}
      />
      <div
        aria-hidden
        className="absolute rounded-xl ring-2 ring-emerald-500/70"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
        }}
      />

      <div
        ref={cardRef}
        className="pointer-events-auto absolute z-[2] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <p
          id={titleId}
          className="text-xs font-semibold uppercase tracking-wide text-emerald-400"
        >
          {step === 1 ? "Step 1" : "Step 2"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-200">
          {step === 1 ?
            "Paste or write your lyrics in here."
          : "Generate Critique."}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step === 2 ?
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
              >
                Back
              </button>
            : null}
            {step === 1 ?
              <button
                type="button"
                onClick={onNext}
                className="rounded-lg bg-emerald-700/90 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600"
              >
                Next
              </button>
            : (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg bg-emerald-700/90 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
