/** Resolved line height in CSS pixels (handles unitless multipliers). */
function parseLineHeightPx(lineHeight: string, fontSizePx: number): number {
  if (!lineHeight || lineHeight === "normal") {
    return fontSizePx * 1.25;
  }
  const n = parseFloat(lineHeight);
  if (Number.isNaN(n) || n <= 0) {
    return fontSizePx * 1.25;
  }
  if (/px/i.test(lineHeight)) {
    return n;
  }
  if (n < fontSizePx * 1.2) {
    return n * fontSizePx;
  }
  return n;
}

/** Canvas-based width for matching textarea font (caret / popup positioning). */
function measureTextWidth(text: string, font: string): number {
  if (typeof document === "undefined") return text.length * 7;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 7;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export type SelectionPopupPlacement = "above" | "below";

/**
 * Viewport coordinates for a small popover anchored to `charIndex` on its line.
 * `above`: top edge of that line (popover sits above via translateY(-100%)).
 * `below`: bottom edge of that line (popover sits below).
 */
export function getSelectionPopupAnchor(
  el: HTMLTextAreaElement,
  value: string,
  charIndex: number,
  placement: SelectionPopupPlacement = "below",
): { top: number; left: number } {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const fs = parseFloat(style.fontSize) || 14;
  const font = `${style.fontWeight} ${fs}px ${style.fontFamily}`;
  const lh = parseLineHeightPx(style.lineHeight, fs);
  const pt = parseFloat(style.paddingTop) || 0;
  const pl = parseFloat(style.paddingLeft) || 0;
  const pr = parseFloat(style.paddingRight) || 0;
  const idx = Math.max(0, Math.min(charIndex, value.length));
  const before = value.slice(0, idx);
  const lineIdx = before.split("\n").length - 1;
  const lastNl = before.lastIndexOf("\n");
  const colText = value.slice(lastNl + 1, idx);
  const maxW = Math.max(0, el.clientWidth - pl - pr);
  const w = Math.min(measureTextWidth(colText, font), maxW);
  const lineTop = rect.top + pt + lineIdx * lh - el.scrollTop;
  const top =
    placement === "above" ? lineTop : lineTop + lh;
  const left = rect.left + pl + w - el.scrollLeft;
  return { top, left };
}

/**
 * Top of the first line of the range + viewport X of the right edge of the
 * selected text on that line (popover: translate(-100%, -100%) from `left`/`top`).
 */
export function getSelectionTopRightAnchor(
  el: HTMLTextAreaElement,
  value: string,
  selStart: number,
  selEnd: number,
): { lineTop: number; rightX: number } {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const fs = parseFloat(style.fontSize) || 14;
  const font = `${style.fontWeight} ${fs}px ${style.fontFamily}`;
  const lh = parseLineHeightPx(style.lineHeight, fs);
  const pt = parseFloat(style.paddingTop) || 0;
  const pl = parseFloat(style.paddingLeft) || 0;
  const pr = parseFloat(style.paddingRight) || 0;
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const a = Math.max(0, Math.min(lo, value.length));
  const b = Math.max(0, Math.min(hi, value.length));

  const beforeA = value.slice(0, a);
  const lineIdx = beforeA.split("\n").length - 1;
  const lineStart = beforeA.lastIndexOf("\n") + 1;
  const nextNl = value.indexOf("\n", a);
  const lineEndExclusive = nextNl === -1 ? value.length : nextNl;
  const rightCharExclusive = Math.min(b, lineEndExclusive);

  const colToRight = value.slice(lineStart, rightCharExclusive);
  const maxW = Math.max(0, el.clientWidth - pl - pr);
  const w = Math.min(measureTextWidth(colToRight, font), maxW);
  const lineTop = rect.top + pt + lineIdx * lh - el.scrollTop;
  const rightX = rect.left + pl + w - el.scrollLeft;
  return { lineTop, rightX };
}
