"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LineAnnotation } from "@/lib/lineAnnotations";

type Props = {
  value: string;
  onChange: (value: string) => void;
  lineFeedbackByIndex: Map<number, LineAnnotation[]>;
  onMobileSave?: () => void;
  mobileSavePending?: boolean;
};

const TEXTAREA_CLASSES =
  "box-border w-full flex-1 min-h-[44dvh] resize-y rounded-lg border-0 bg-transparent p-3 text-[15px] font-sans leading-relaxed text-transparent caret-zinc-100 outline-none whitespace-pre sm:min-h-[56dvh] lg:min-h-0";

type LineHighlightTier = "weak" | "promising" | "strong";

type TooltipFeedbackEntry = { label: string; feedback: string };

export function DraftEditor({
  value,
  onChange,
  lineFeedbackByIndex,
  onMobileSave,
  mobileSavePending = false,
}: Props) {
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
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    tier: LineHighlightTier;
    entries: TooltipFeedbackEntry[];
  } | null>(null);
  const [uiFontSize, setUiFontSize] = useState(15);
  const [styleOps, setStyleOps] = useState<StyleOp[]>([]);
  const [showHighlights, setShowHighlights] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy Draft");
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  const lines = useMemo(() => value.split("\n"), [value]);
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

  const syncBackdropScroll = useCallback((el: HTMLTextAreaElement) => {
    const inner = backdropInnerRef.current;
    if (inner) {
      inner.style.transform = `translate(-${el.scrollLeft}px, -${el.scrollTop}px)`;
    }
  }, []);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (el) syncBackdropScroll(el);
  }, [value, syncBackdropScroll]);

  useEffect(() => {
    if (lineFeedbackByIndex.size > 0) {
      setShowHighlights(true);
    }
  }, [lineFeedbackByIndex]);

  const updateTooltip = useCallback(
    (clientX: number, clientY: number) => {
      const el = taRef.current;
      if (!el || !showHighlights || lineFeedbackByIndex.size === 0) {
        setTooltip(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const padTop = parseFloat(style.paddingTop) || 0;
      let lh = parseFloat(style.lineHeight);
      if (Number.isNaN(lh) || lh <= 0) {
        const fs = parseFloat(style.fontSize) || 15;
        lh = fs * 1.25;
      }
      const yIn = clientY - rect.top + el.scrollTop - padTop;
      if (yIn < 0) {
        setTooltip(null);
        return;
      }
      // Bias to line center so the tooltip triggers on the highlighted line itself.
      const idx = Math.floor((yIn + lh * 0.5) / lh);
      if (idx < 0 || idx >= lines.length) {
        setTooltip(null);
        return;
      }
      const notes = lineFeedbackByIndex.get(idx);
      if (!notes?.length) {
        setTooltip(null);
        return;
      }
      const tier: LineHighlightTier =
        notes.some((n) => n.strength === "weak") ? "weak"
        : notes.some((n) => n.strength === "promising") ? "promising"
        : "strong";
      const entries: TooltipFeedbackEntry[] = notes.map((note) => {
        const label =
          note.strength === "strong" ? "Strong"
          : note.strength === "promising" ? "Promising"
          : "Room for Improvement";
        return { label, feedback: note.feedback };
      });
      setTooltip({
        x: clientX,
        y: clientY,
        tier,
        entries,
      });
    },
    [lineFeedbackByIndex, lines.length, showHighlights],
  );

  const handleCopyDraft = useCallback(async () => {
    if (!value.length) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy Draft"), 1500);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy Draft"), 1500);
    }
  }, [value]);

  const controlButtonClasses =
    "rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

  const renderControls = (buttonClassName: string) => (
    <>
      <button
        type="button"
        onClick={() => setUiFontSize((v) => Math.max(12, v - 1))}
        className={buttonClassName}
        aria-label="Decrease draft font size"
      >
        A-
      </button>
      <button
        type="button"
        onClick={() => setUiFontSize((v) => Math.min(24, v + 1))}
        className={buttonClassName}
        aria-label="Increase draft font size"
      >
        A+
      </button>
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
      <button
        type="button"
        onClick={() => void handleCopyDraft()}
        disabled={!value.length}
        className={buttonClassName}
        aria-label="Copy full draft text to clipboard"
      >
        {copyLabel}
      </button>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Draft
        </label>
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileControlsOpen((v) => !v)}
            className="rounded-full border border-zinc-700/70 bg-transparent px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900/30"
            aria-label={
              mobileControlsOpen ? "Hide draft editor controls" : "Show draft editor controls"
            }
          >
            Tools
          </button>
          {onMobileSave ? (
            <button
              type="button"
              onClick={onMobileSave}
              disabled={mobileSavePending}
              className="rounded-md bg-blue-700/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition hover:bg-blue-600/90 disabled:opacity-50"
            >
              {mobileSavePending ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex">
        {renderControls(controlButtonClasses)}
      </div>
      {mobileControlsOpen ? (
        <div className="shrink-0 flex flex-wrap items-center gap-2 lg:hidden">
          {renderControls(controlButtonClasses)}
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 focus-within:border-amber-700/40 focus-within:ring-1 focus-within:ring-amber-600/25">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        >
          <div
            ref={backdropInnerRef}
            className="inline-block min-w-full whitespace-pre p-3 text-left text-[15px] font-sans leading-relaxed text-zinc-100"
            style={{
              fontSize: `${uiFontSize}px`,
            }}
          >
            {lines.map((line, i) => {
              const notes = lineFeedbackByIndex.get(i);
              const has = Boolean(notes?.length);
              const hasWeak = notes?.some((note) => note.strength === "weak");
              const hasPromising = notes?.some(
                (note) => note.strength === "promising",
              );
              const lineHighlightClass =
                hasWeak ?
                  "rounded-sm bg-pink-600/35 px-0.5 text-zinc-50"
                : hasPromising ?
                  "rounded-sm bg-yellow-500/25 px-0.5 text-zinc-50"
                : "rounded-sm bg-emerald-600/35 px-0.5 text-zinc-50";

              let globalIndex = 0;
              for (let li = 0; li < i; li += 1) globalIndex += lines[li].length + 1;
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
                    fontSize: `${Math.max(12, Math.min(32, uiFontSize + seg.style.fontSizeDelta))}px`,
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
                  {i < lines.length - 1 ? "\n" : null}
                </span>
              );
            })}
          </div>
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => syncBackdropScroll(e.currentTarget)}
          onMouseMove={(e) => updateTooltip(e.clientX, e.clientY)}
          onMouseLeave={() => setTooltip(null)}
          onKeyDown={(e) => {
            const meta = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();
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
          className={`relative z-10 min-h-0 flex-1 overflow-auto ${TEXTAREA_CLASSES}`}
          style={{
            fontSize: `${uiFontSize}px`,
            colorScheme: "dark",
          }}
          placeholder="Paste or write your full lyrics/poetry draft…"
          spellCheck
        />
      </div>
      {tooltip ? (
        <div
          className={`pointer-events-none fixed z-[100] max-h-64 max-w-sm overflow-y-auto rounded-lg border-2 bg-zinc-900/95 p-3 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur-sm ${
            tooltip.tier === "weak" ? "border-pink-600/75"
            : tooltip.tier === "promising" ? "border-yellow-500/75"
            : "border-green-600/75"
          }`}
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.entries.map((entry, i) => (
            <div
              key={i}
              className={i > 0 ? "mt-3 border-t border-zinc-600/40 pt-3" : undefined}
            >
              <strong className="font-semibold text-zinc-100">{entry.label}</strong>
              {": "}
              {entry.feedback}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
