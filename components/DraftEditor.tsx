"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  lineFeedbackByIndex: Map<number, string[]>;
};

const TEXTAREA_CLASSES =
  "box-border w-full flex-1 resize-y rounded-lg border-0 bg-transparent p-3 text-[15px] font-sans leading-relaxed text-transparent caret-zinc-100 outline-none whitespace-pre";

export function DraftEditor({
  value,
  onChange,
  lineFeedbackByIndex,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropInnerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const lines = useMemo(() => value.split("\n"), [value]);

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
      const idx = Math.floor(yIn / lh);
      if (idx < 0 || idx >= lines.length) {
        setTooltip(null);
        return;
      }
      const notes = lineFeedbackByIndex.get(idx);
      if (!notes?.length) {
        setTooltip(null);
        return;
      }
      setTooltip({
        x: clientX,
        y: clientY,
        text: notes.join("\n\n—\n\n"),
      });
    },
    [lineFeedbackByIndex, lines.length],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Draft
      </label>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 focus-within:border-amber-700/40 focus-within:ring-1 focus-within:ring-amber-600/25">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        >
          <div
            ref={backdropInnerRef}
            className="inline-block min-w-full whitespace-pre p-3 text-left text-[15px] font-sans leading-relaxed text-zinc-100"
          >
            {lines.map((line, i) => {
              const has = lineFeedbackByIndex.has(i);
              return (
                <span key={i}>
                  {has ? (
                    <mark className="rounded-sm bg-amber-900/45 px-0.5 text-zinc-100">
                      {line}
                    </mark>
                  ) : (
                    <span>{line}</span>
                  )}
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
          className={`relative z-10 min-h-0 flex-1 overflow-auto ${TEXTAREA_CLASSES}`}
          placeholder="Paste or write your full lyric draft…"
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
      {lineFeedbackByIndex.size > 0 ? (
        <p className="text-[11px] text-zinc-600">
          Amber lines have notes—hover a line in the draft to read them; full
          line notes also appear in the Critique panel.
        </p>
      ) : null}
    </div>
  );
}
