"use client";

import type { ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LineAnnotation } from "@/lib/lineAnnotations";
import {
  clampTooltipToViewport,
  lineIndexFromContentY,
} from "@/lib/draft/lineFeedbackPointer";
import { getSelectionTopRightAnchor } from "@/lib/draft/selectionPopupAnchor";
import type { ChatSelectionPayload, DraftEditorContext } from "@/types/chat";

const MIN_UI_FONT_PX = 8;
const MAX_UI_FONT_PX = 24;
const MIN_SEGMENT_FONT_PX = 8;
const MAX_SEGMENT_FONT_PX = 32;
/** Default draft font on viewports below `lg` (matches Tailwind max-lg). */
const DEFAULT_MOBILE_UI_FONT_PX = 14;
const DEFAULT_DESKTOP_UI_FONT_PX = 16;

export type DraftEditorHandle = {
  toggleMobileTools: () => void;
};

export type DraftEditorProps = {
  value: string;
  onChange: (value: string) => void;
  lineFeedbackByIndex: Map<number, LineAnnotation[]>;
  /** Changes only when critique line feedback content changes (new generation), not when the draft text edits. */
  lineFeedbackAutoShowKey?: string;
  /** When set, flushes debounced server persistence (e.g. song mode autosave) on editor blur. */
  onPersistFlush?: () => void;
  onDraftContextChange?: (ctx: DraftEditorContext) => void;
  /** When true and user highlights text, show "Add to workshop" (requires critique). */
  addToChatEnabled?: boolean;
  onAddSelectionToChat?: (payload: ChatSelectionPayload) => void;
  /** Shown on the top-right of the draft header (e.g. voice memos). */
  headerTrailing?: ReactNode;
  /** Replaces the default “Draft” label (e.g. Draft · Brainstorm tabs). */
  headerLeading?: ReactNode;
  /** When false, hides critique highlight toggle (e.g. brainstorm pane). */
  showFeedbackToggle?: boolean;
  /** Read-only text; keeps line feedback highlights and hover tooltips. */
  readOnly?: boolean;
  /** Idle label for the copy button (default “Copy Draft”). */
  copyButtonIdleLabel?: string;
  placeholder?: string;
  /** Rendered between the toolbar and the editor (e.g. short notice). */
  bodyPrefix?: ReactNode;
  textInputAriaLabel?: string;
  /** Extra row at top of the fixed mobile toolbar (e.g. back, title, menu). */
  mobileTopRow?: ReactNode;
  /**
   * When true (e.g. song mobile), the draft tools toggle is not shown in the tab row;
   * call `ref.toggleMobileTools()` from the parent top bar instead.
   */
  externalMobileToolsTrigger?: boolean;
};

/** Synthetic overlay: hide glyphs in WebKit (caret stays visible); other engines use caret-color + transparent color. */
const TEXTAREA_CLASSES =
  "box-border h-full min-h-[min(50dvh,28rem)] w-full flex-1 resize-none rounded-lg border-0 bg-transparent p-4 max-lg:pl-5 max-lg:pt-8 text-sm font-sans leading-[1.625] whitespace-pre caret-zinc-100 outline-none [touch-action:pan-x_pan-y] overscroll-none [-webkit-text-fill-color:transparent] [color:rgb(244_244_245)] placeholder:text-zinc-500/45 placeholder:[-webkit-text-fill-color:rgb(161_161_170_/_0.45)] sm:min-h-[min(56dvh,32rem)] sm:resize-y lg:min-h-0 lg:text-base";

type LineHighlightTier = "suggestion" | "promising" | "strong";

type TooltipFeedbackEntry = { label: string; feedback: string };

export const DraftEditor = forwardRef<DraftEditorHandle, DraftEditorProps>(
  function DraftEditor(
    {
      value,
      onChange,
      lineFeedbackByIndex,
      lineFeedbackAutoShowKey = "",
      onPersistFlush,
      onDraftContextChange,
      addToChatEnabled = false,
      onAddSelectionToChat,
      headerTrailing,
      headerLeading,
      showFeedbackToggle = true,
      readOnly = false,
      copyButtonIdleLabel = "Copy Draft",
      placeholder = "Write your lyrics here...",
      bodyPrefix,
      textInputAriaLabel,
      mobileTopRow,
      externalMobileToolsTrigger = false,
    },
    ref,
  ) {
  type StyleOp = {
    start: number;
    end: number;
    bold?: boolean;
    underline?: boolean;
    fontSizeDelta?: number;
  };
  type EffectiveStyle = {
    bold: boolean;
    underline: boolean;
    fontSizeDelta: number;
  };

  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropInnerRef = useRef<HTMLDivElement>(null);
  const mobileToolbarRef = useRef<HTMLDivElement>(null);
  const tooltipPopoverRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  /** After a tap to show line feedback, ignore scroll-driven tooltip clears briefly (iOS scrolls to caret). */
  const touchTooltipScrollGuardUntilRef = useRef(0);
  const lastTextareaScrollRef = useRef<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });
  const [mobileToolbarInsetPx, setMobileToolbarInsetPx] = useState(56);
  const [tooltip, setTooltip] = useState<{
    anchorX: number;
    anchorY: number;
    tier: LineHighlightTier;
    entries: TooltipFeedbackEntry[];
  } | null>(null);
  const [uiFontSize, setUiFontSize] = useState(DEFAULT_DESKTOP_UI_FONT_PX);
  const [styleOps, setStyleOps] = useState<StyleOp[]>([]);
  const [showHighlights, setShowHighlights] = useState(true);
  const [copyLabel, setCopyLabel] = useState(copyButtonIdleLabel);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      toggleMobileTools: () => setMobileToolsOpen((o) => !o),
    }),
    [],
  );

  /** `top` = popover bottom Y; `rightX` = selection top-right X (use translate(-100%, -100%)). */
  const [addToChatAnchor, setAddToChatAnchor] = useState<{
    top: number;
    rightX: number;
  } | null>(null);
  const addToChatPopoverRef = useRef<HTMLDivElement>(null);
  const updateAddToChatAnchorRef = useRef<() => void>(() => {});

  const lines = useMemo(() => value.split("\n"), [value]);
  /** Must stay in lockstep with `value`: the textarea glyphs are transparent, so this layer is what users read while typing. */
  const backdropLines = useMemo(() => value.split("\n"), [value]);
  const totalChars = value.length;

  const getStyleAt = useCallback(
    (charIndex: number): EffectiveStyle => {
      let bold = false;
      let underline = false;
      let fontSizeDelta = 0;
      for (const op of styleOps) {
        if (charIndex >= op.start && charIndex < op.end) {
          if (typeof op.bold === "boolean") bold = op.bold;
          if (typeof op.underline === "boolean") underline = op.underline;
          if (typeof op.fontSizeDelta === "number") {
            fontSizeDelta += op.fontSizeDelta;
          }
        }
      }
      return { bold, underline, fontSizeDelta };
    },
    [styleOps],
  );

  const updateAddToChatAnchor = useCallback(() => {
    if (!addToChatEnabled || !onAddSelectionToChat) {
      setAddToChatAnchor(null);
      return;
    }
    const el = taRef.current;
    if (!el) return;
    const startRaw = el.selectionStart ?? 0;
    const endRaw = el.selectionEnd ?? 0;
    const start = Math.max(0, Math.min(startRaw, totalChars));
    const end = Math.max(0, Math.min(endRaw, totalChars));
    const a = Math.min(start, end);
    const b = Math.max(start, end);
    if (a === b || !value.slice(a, b).trim()) {
      setAddToChatAnchor(null);
      return;
    }
    const { lineTop, rightX } = getSelectionTopRightAnchor(el, value, a, b);
    const gap = 5;
    const approxPopH = 26;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const popW = 118;
    const clampedRightX = Math.min(
      Math.max(8 + popW, rightX),
      vw - 8,
    );
    let popBottom = lineTop - gap;
    if (popBottom < 8 + approxPopH) {
      popBottom = 8 + approxPopH;
    }
    setAddToChatAnchor({ top: popBottom, rightX: clampedRightX });
  }, [addToChatEnabled, onAddSelectionToChat, totalChars, value]);

  updateAddToChatAnchorRef.current = updateAddToChatAnchor;

  const reportDraftContext = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const startRaw = el.selectionStart ?? 0;
    const endRaw = el.selectionEnd ?? 0;
    const start = Math.max(0, Math.min(startRaw, totalChars));
    const end = Math.max(0, Math.min(endRaw, totalChars));
    const a = Math.min(start, end);
    const b = Math.max(start, end);
    const caretLine = value.slice(0, start).split("\n").length - 1;
    let selection: DraftEditorContext["selection"] = null;
    if (a !== b) {
      const selText = value.slice(a, b);
      const startLine = value.slice(0, a).split("\n").length - 1;
      const endLine = value.slice(0, b).split("\n").length - 1;
      selection = { startLine, endLine, text: selText };
    }
    onDraftContextChange?.({ selection, caretLine });
    updateAddToChatAnchor();
  }, [onDraftContextChange, totalChars, value, updateAddToChatAnchor]);

  const getSelectionBounds = useCallback(() => {
    const el = taRef.current;
    if (!el) return null;
    const start = Math.max(0, Math.min(el.selectionStart ?? 0, totalChars));
    const end = Math.max(0, Math.min(el.selectionEnd ?? 0, totalChars));
    if (start === end) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }, [totalChars]);

  const isStyleEnabledForSelection = useCallback(
    (selection: { start: number; end: number }, key: "bold" | "underline") => {
      for (let i = selection.start; i < selection.end; i += 1) {
        const s = getStyleAt(i);
        if (!s[key]) return false;
      }
      return true;
    },
    [getStyleAt],
  );

  const applyToggleStyle = useCallback(
    (key: "bold" | "underline") => {
      const selection = getSelectionBounds();
      if (!selection) return;
      const enabled = isStyleEnabledForSelection(selection, key);
      setStyleOps((ops) => [...ops, { ...selection, [key]: !enabled }]);
    },
    [getSelectionBounds, isStyleEnabledForSelection],
  );

  const applyFontDelta = useCallback(
    (delta: number) => {
      const selection = getSelectionBounds();
      if (!selection) return;
      setStyleOps((ops) => [...ops, { ...selection, fontSizeDelta: delta }]);
    },
    [getSelectionBounds],
  );

  const applyBackdropScroll = useCallback((el: HTMLTextAreaElement) => {
    const inner = backdropInnerRef.current;
    if (inner) {
      inner.style.transform = `translate3d(-${el.scrollLeft}px,-${el.scrollTop}px,0)`;
    }
  }, []);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    lastTextareaScrollRef.current = {
      left: el.scrollLeft,
      top: el.scrollTop,
    };
    const mq = window.matchMedia("(max-width: 1023px)");
    const COMMIT_PX = 10;
    let axisLock: "x" | "y" | null = null;
    let freezeX = 0;
    let freezeY = 0;
    let startClientX = 0;
    let startClientY = 0;

    const enforceAxis = () => {
      if (!mq.matches || axisLock === null) return;
      if (axisLock === "y" && el.scrollLeft !== freezeX) {
        el.scrollLeft = freezeX;
      }
      if (axisLock === "x" && el.scrollTop !== freezeY) {
        el.scrollTop = freezeY;
      }
    };

    const SCROLL_CLEAR_EPS_PX = 5;

    const onScroll = () => {
      enforceAxis();
      const sl = el.scrollLeft;
      const st = el.scrollTop;
      const prev = lastTextareaScrollRef.current;
      const delta = Math.abs(sl - prev.left) + Math.abs(st - prev.top);
      lastTextareaScrollRef.current = { left: sl, top: st };

      applyBackdropScroll(el);
      updateAddToChatAnchorRef.current();
      if (performance.now() < touchTooltipScrollGuardUntilRef.current) return;
      if (delta < SCROLL_CLEAR_EPS_PX) return;
      setTooltip((t) => (t ? null : t));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!mq.matches || e.touches.length !== 1) return;
      axisLock = null;
      startClientX = e.touches[0].clientX;
      startClientY = e.touches[0].clientY;
      freezeX = el.scrollLeft;
      freezeY = el.scrollTop;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!mq.matches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startClientX;
      const dy = t.clientY - startClientY;
      if (axisLock === null) {
        if (dx * dx + dy * dy < COMMIT_PX * COMMIT_PX) return;
        axisLock = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        freezeX = el.scrollLeft;
        freezeY = el.scrollTop;
      }
      enforceAxis();
    };

    const onTouchEnd = () => {
      axisLock = null;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    applyBackdropScroll(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [applyBackdropScroll]);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (el) applyBackdropScroll(el);
  }, [value, applyBackdropScroll]);

  useLayoutEffect(() => {
    const node = tooltipPopoverRef.current;
    if (!tooltip || !node) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const offsetX = 14;
    const offsetY = 14;

    const apply = () => {
      node.style.left = `${tooltip.anchorX + offsetX}px`;
      node.style.top = `${tooltip.anchorY + offsetY}px`;
      const rect = node.getBoundingClientRect();
      const { left, top } = clampTooltipToViewport({
        popW: rect.width,
        popH: rect.height,
        vw,
        vh,
        anchorX: tooltip.anchorX,
        anchorY: tooltip.anchorY,
        offsetX,
        offsetY,
        margin,
      });
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    };

    apply();
    const id = requestAnimationFrame(() => {
      apply();
    });
    return () => cancelAnimationFrame(id);
  }, [tooltip]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) {
      setUiFontSize(DEFAULT_MOBILE_UI_FONT_PX);
    }
  }, []);

  useLayoutEffect(() => {
    const toolbar = mobileToolbarRef.current;
    if (!toolbar || typeof ResizeObserver === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      if (!mq.matches) return;
      setMobileToolbarInsetPx(toolbar.getBoundingClientRect().height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(toolbar);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (lineFeedbackAutoShowKey) {
      setShowHighlights(true);
    }
  }, [lineFeedbackAutoShowKey]);

  useEffect(() => {
    if (!addToChatEnabled) {
      setAddToChatAnchor(null);
    }
  }, [addToChatEnabled]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (taRef.current?.contains(t)) return;
      if (addToChatPopoverRef.current?.contains(t)) return;
      setAddToChatAnchor(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const onResize = () => updateAddToChatAnchorRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleAddSelectionToChat = useCallback(() => {
    if (!onAddSelectionToChat) return;
    const el = taRef.current;
    if (!el) return;
    const startRaw = el.selectionStart ?? 0;
    const endRaw = el.selectionEnd ?? 0;
    const start = Math.max(0, Math.min(startRaw, totalChars));
    const end = Math.max(0, Math.min(endRaw, totalChars));
    const a = Math.min(start, end);
    const b = Math.max(start, end);
    if (a === b) return;
    const text = value.slice(a, b);
    if (!text.trim()) return;
    const startLine = value.slice(0, a).split("\n").length - 1;
    const endLine = value.slice(0, b).split("\n").length - 1;
    onAddSelectionToChat({ startLine, endLine, text });
    setAddToChatAnchor(null);
  }, [onAddSelectionToChat, totalChars, value]);

  const updateTooltip = useCallback(
    (clientX: number, clientY: number) => {
      const el = taRef.current;
      if (!el || !showHighlights || lineFeedbackByIndex.size === 0) {
        setTooltip(null);
        return;
      }
      /**
       * Map pointer Y into a logical line index. Do not use caretPositionFromPoint /
       * caretRangeFromPoint on `<textarea>`: Chromium and WebKit often report offset 0 for
       * almost every hit, which pins the tooltip to the first line (or hides it when line 0
       * has no feedback). Geometry matches the highlight layer for typical short lines.
       */
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const padTop = parseFloat(style.paddingTop) || 0;
      let lh = parseFloat(style.lineHeight);
      if (Number.isNaN(lh) || lh <= 0) {
        const fs = parseFloat(style.fontSize) || 15;
        lh = fs * 1.625;
      }
      const yIn = clientY - rect.top + el.scrollTop - padTop;
      const idx = lineIndexFromContentY(yIn, lh, lines.length);
      if (idx === null) {
        setTooltip(null);
        return;
      }
      const notes = lineFeedbackByIndex.get(idx);
      if (!notes?.length) {
        setTooltip(null);
        return;
      }
      const tier: LineHighlightTier =
        notes.some((n) => n.strength === "suggestion") ? "suggestion"
        : notes.some((n) => n.strength === "promising") ? "promising"
        : "strong";
      const entries: TooltipFeedbackEntry[] = notes.map((note) => {
        const label =
          note.strength === "strong" ? "Strong"
          : note.strength === "promising" ? "Promising"
          : "Suggestion";
        return { label, feedback: note.feedback };
      });
      setTooltip({
        anchorX: clientX,
        anchorY: clientY,
        tier,
        entries,
      });
    },
    [lineFeedbackByIndex, lines.length, showHighlights],
  );

  const highlightLayer = useMemo(() => {
    return backdropLines.map((line, i) => {
      const notes = lineFeedbackByIndex.get(i);
      const has = Boolean(notes?.length);
      const hasSuggestion = notes?.some((note) => note.strength === "suggestion");
      const hasPromising = notes?.some((note) => note.strength === "promising");
      const lineHighlightClass =
        hasSuggestion ?
          "rounded-sm bg-violet-500/45 px-0.5 text-zinc-50"
        : hasPromising ?
          "rounded-sm bg-blue-600/45 px-0.5 text-zinc-50"
        : "rounded-sm bg-emerald-600/35 px-0.5 text-zinc-50";

      let globalIndex = 0;
      for (let li = 0; li < i; li += 1) globalIndex += backdropLines[li].length + 1;
      const segments: Array<{
        text: string;
        style: EffectiveStyle;
      }> = [];
      for (let charOffset = 0; charOffset < line.length; charOffset += 1) {
        const ch = line[charOffset];
        const charStyle = getStyleAt(globalIndex + charOffset);
        const last = segments[segments.length - 1];
        if (
          last &&
          last.style.bold === charStyle.bold &&
          last.style.underline === charStyle.underline &&
          last.style.fontSizeDelta === charStyle.fontSizeDelta
        ) {
          last.text += ch;
        } else {
          segments.push({ text: ch, style: charStyle });
        }
      }
      if (segments.length === 0) {
        segments.push({
          text: "",
          style: { bold: false, underline: false, fontSizeDelta: 0 },
        });
      }

      const renderedLine = segments.map((seg, segIdx) => (
        <span
          key={`${i}-${segIdx}`}
          style={{
            fontWeight: seg.style.bold ? 700 : 400,
            textDecoration: seg.style.underline ? "underline" : "none",
            fontSize: `${Math.max(
              MIN_SEGMENT_FONT_PX,
              Math.min(MAX_SEGMENT_FONT_PX, uiFontSize + seg.style.fontSizeDelta),
            )}px`,
          }}
        >
          {seg.text}
        </span>
      ));

      return (
        <span key={i}>
          {showHighlights && has ?
            <mark className={lineHighlightClass}>{renderedLine}</mark>
          : renderedLine}
          {i < backdropLines.length - 1 ? "\n" : null}
        </span>
      );
    });
  }, [backdropLines, getStyleAt, lineFeedbackByIndex, showHighlights, uiFontSize]);

  const handleCopyDraft = useCallback(async () => {
    if (!value.length) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel(copyButtonIdleLabel), 1500);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel(copyButtonIdleLabel), 1500);
    }
  }, [copyButtonIdleLabel, value]);

  const controlButtonClasses =
    "rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

  const renderControls = (buttonClassName: string) => (
    <>
      <button
        type="button"
        onClick={() => setUiFontSize((v) => Math.max(MIN_UI_FONT_PX, v - 1))}
        className={buttonClassName}
        aria-label="Decrease draft font size"
      >
        A-
      </button>
      <button
        type="button"
        onClick={() => setUiFontSize((v) => Math.min(MAX_UI_FONT_PX, v + 1))}
        className={buttonClassName}
        aria-label="Increase draft font size"
      >
        A+
      </button>
      {!readOnly ?
        <>
          <button
            type="button"
            onClick={() => applyToggleStyle("bold")}
            className={buttonClassName}
            aria-label="Toggle bold for selected draft text"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyToggleStyle("underline")}
            className={buttonClassName}
            aria-label="Toggle underline for selected draft text"
          >
            U
          </button>
        </>
      : null}
      {showFeedbackToggle ?
        <button
          type="button"
          onClick={() => {
            setShowHighlights((prev) => !prev);
            setTooltip(null);
          }}
          className={buttonClassName}
          aria-label="Show or hide draft feedback highlights"
        >
          {showHighlights ? "Hide Feedback" : "Show Feedback"}
        </button>
      : null}
      <button
        type="button"
        onClick={() => void handleCopyDraft()}
        disabled={!value.length}
        className={buttonClassName}
        aria-label="Copy full text to clipboard"
      >
        {copyLabel}
      </button>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden max-lg:min-h-0 max-lg:flex-1 max-lg:gap-0">
      <div
        ref={mobileToolbarRef}
        className="flex shrink-0 flex-col gap-2 border-b border-transparent max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-[50] max-lg:border-zinc-800/60 max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pb-2 max-lg:pt-[max(0.5rem,env(safe-area-inset-top))] max-lg:backdrop-blur-md lg:relative lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0"
      >
        {mobileTopRow ? (
          <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-800/40 pb-2 lg:hidden">
            {mobileTopRow}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-between gap-2">
          {headerLeading ?? (
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Draft
            </label>
          )}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {!externalMobileToolsTrigger ?
              <div className="order-2 flex items-center gap-1 lg:order-none lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen((o) => !o)}
                  className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/60 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80"
                  aria-expanded={mobileToolsOpen}
                  aria-label={mobileToolsOpen ? "Close draft tools" : "Open draft tools"}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            : null}
            {headerTrailing ?
              <div className="order-1 shrink-0 lg:order-none">{headerTrailing}</div>
            : null}
          </div>
        </div>
        {mobileToolsOpen ?
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5 pb-1 lg:hidden">
            {renderControls(controlButtonClasses)}
          </div>
        : null}
        {bodyPrefix ?
          <div className="shrink-0">{bodyPrefix}</div>
        : null}
        <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex">
          {renderControls(controlButtonClasses)}
        </div>
      </div>
      <div
        className="shrink-0 lg:hidden"
        style={{ height: mobileToolbarInsetPx }}
        aria-hidden
      />
      <div className="relative flex min-h-[min(50dvh,28rem)] flex-1 flex-col overflow-hidden overscroll-none rounded-lg border border-zinc-800 bg-zinc-900/60 focus-within:border-amber-700/40 focus-within:ring-1 focus-within:ring-amber-600/25 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:focus-within:border-transparent max-lg:focus-within:ring-0 lg:min-h-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden overscroll-none rounded-[inherit]"
        >
          <div
            ref={backdropInnerRef}
            className="inline-block min-w-full whitespace-pre p-4 max-lg:pl-5 max-lg:pt-8 text-left text-sm font-sans leading-[1.625] text-zinc-100 will-change-transform lg:text-base"
            style={{
              fontSize: `${uiFontSize}px`,
              lineHeight: 1.625,
            }}
          >
            {value.length === 0 && placeholder ?
              <span
                className="pointer-events-none block whitespace-pre-wrap break-words text-zinc-400/50"
                style={{
                  fontSize: `${uiFontSize}px`,
                  lineHeight: 1.625,
                }}
              >
                {placeholder}
              </span>
            : highlightLayer}
          </div>
        </div>
        <textarea
          ref={taRef}
          readOnly={readOnly}
          value={value}
          onChange={(e) => {
            if (!readOnly) onChange(e.target.value);
          }}
          onInput={reportDraftContext}
          onSelect={reportDraftContext}
          onKeyUp={reportDraftContext}
          onClick={reportDraftContext}
          onFocus={reportDraftContext}
          onBlur={() => {
            reportDraftContext();
            onPersistFlush?.();
          }}
          onMouseMove={(e) => updateTooltip(e.clientX, e.clientY)}
          onMouseLeave={() => setTooltip(null)}
          onKeyDown={(e) => {
            if (readOnly) return;
            const meta = e.metaKey || e.ctrlKey;
            const key = (e.key ?? "").toLowerCase();
            if (meta && key === "b") {
              e.preventDefault();
              applyToggleStyle("bold");
              return;
            }
            if (meta && key === "u") {
              e.preventDefault();
              applyToggleStyle("underline");
              return;
            }
            if (meta && (key === "=" || key === "+" || key === ".")) {
              e.preventDefault();
              applyFontDelta(1);
              return;
            }
            if (meta && (key === "-" || key === "_")) {
              e.preventDefault();
              applyFontDelta(-1);
            }
          }}
          className={`pointer-events-auto relative z-20 flex-1 overflow-auto ${TEXTAREA_CLASSES}`}
          style={{
            fontSize: `${uiFontSize}px`,
            lineHeight: 1.625,
            colorScheme: "dark",
          }}
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            touchStartRef.current = { x: t.clientX, y: t.clientY };
            setTooltip(null);
          }}
          onTouchCancel={() => {
            touchStartRef.current = null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (!start || e.changedTouches.length !== 1) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            /** Generous slop so light taps still count after iOS hit-test / focus jitter. */
            const TAP_SLOP_PX = 26;
            if (dx * dx + dy * dy > TAP_SLOP_PX * TAP_SLOP_PX) return;
            const cx = t.clientX;
            const cy = t.clientY;
            touchTooltipScrollGuardUntilRef.current = performance.now() + 1000;
            const run = () => {
              updateTooltip(cx, cy);
            };
            run();
            requestAnimationFrame(run);
            requestAnimationFrame(() => {
              requestAnimationFrame(run);
            });
            queueMicrotask(run);
            window.setTimeout(run, 0);
            window.setTimeout(run, 24);
            window.setTimeout(run, 72);
          }}
          placeholder={placeholder}
          aria-label={textInputAriaLabel}
          spellCheck
        />
      </div>
      {tooltip ? (
        <div
          ref={tooltipPopoverRef}
          className={`pointer-events-none fixed z-[100] max-h-64 max-w-sm min-w-0 overflow-y-auto rounded-lg border-2 bg-zinc-900/95 p-3 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur-sm ${
            tooltip.tier === "suggestion" ? "border-violet-500/75"
            : tooltip.tier === "promising" ? "border-blue-500/75"
            : "border-green-600/75"
          }`}
        >
          {tooltip.entries.map((entry, i) => (
            <div
              key={i}
              className={i > 0 ? "mt-3 border-t border-zinc-600/40 pt-3" : undefined}
            >
              <div className="font-semibold text-zinc-100">{entry.label}</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-zinc-200/95">
                {entry.feedback}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {addToChatAnchor && addToChatEnabled && onAddSelectionToChat ?
        <div
          ref={addToChatPopoverRef}
          className="fixed z-[110] overflow-hidden rounded-[5px] border border-zinc-600/75 bg-zinc-950/98 shadow-lg shadow-black/40 backdrop-blur-sm"
          style={{
            top: addToChatAnchor.top,
            left: addToChatAnchor.rightX,
            transform: "translate(-100%, -100%)",
          }}
          role="toolbar"
          aria-label="Selection actions"
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAddSelectionToChat}
            className="rounded-[5px] px-2 py-1 text-[11px] font-medium leading-tight text-zinc-100 transition hover:bg-zinc-800/90"
          >
            Add to workshop
          </button>
        </div>
      : null}
    </div>
  );
});

DraftEditor.displayName = "DraftEditor";
