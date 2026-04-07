"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LineAnnotation } from "@/lib/lineAnnotations";

type Props = {
  value: string;
  onChange: (value: string) => void;
  lineFeedbackByIndex: Map<number, LineAnnotation[]>;
};

const TEXTAREA_CLASSES =
  "box-border w-full flex-1 min-h-[68dvh] resize-y rounded-lg border-0 bg-transparent p-3 text-[15px] font-sans leading-relaxed text-transparent caret-zinc-100 outline-none whitespace-pre lg:min-h-0";

export function DraftEditor({
  value,
  onChange,
  lineFeedbackByIndex,
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
    text: string;
  } | null>(null);
  const [uiFontSize, setUiFontSize] = useState(15);
  const [styleOps, setStyleOps] = useState<StyleOp[]>([]);

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

  const updateTooltip = useCallback(
    (clientX: number, clientY: number) => {
      const el = taRef.current;
      if (!el || lineFeedbackByIndex.size === 0) {
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
      const noteText = notes
        .map((note) =>
          note.category === "praise" ?
            `Praise: ${note.feedback}`
          : `Constructive: ${note.feedback}`,
        )
        .join("\n\n—\n\n");
      setTooltip({
        x: clientX,
        y: clientY,
        text: noteText,
      });
    },
    [lineFeedbackByIndex, lines.length],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <label className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Draft
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setUiFontSize((v) => Math.max(12, v - 1))}
          className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Decrease draft font size"
        >
          A-
        </button>
        <button
          type="button"
          onClick={() => setUiFontSize((v) => Math.min(24, v + 1))}
          className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Increase draft font size"
        >
          A+
        </button>
        <button
          type="button"
          onClick={() => applyToggleStyle("bold")}
          className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Toggle bold for selected draft text"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyToggleStyle("underline")}
          className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Toggle underline for selected draft text"
        >
          U
        </button>
      </div>
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
              const hasConstructive = notes?.some(
                (note) => note.category === "constructive",
              );
              const lineHighlightClass =
                hasConstructive ?
                  "rounded-sm bg-red-900/45 px-0.5 text-zinc-100"
                : "rounded-sm bg-green-900/45 px-0.5 text-zinc-100";

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
                  {has ? <mark className={lineHighlightClass}>{renderedLine}</mark> : renderedLine}
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
          }}
          placeholder="Paste or write your full lyrics/poetry draft…"
          spellCheck
        />
      </div>
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-[100] max-h-64 max-w-sm overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur-sm"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
}
