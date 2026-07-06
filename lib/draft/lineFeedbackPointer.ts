/**
 * Pure helpers for line-level critique hit testing and tooltip placement.
 */

export type TooltipClampArgs = {
  popW: number;
  popH: number;
  vw: number;
  vh: number;
  anchorX: number;
  anchorY: number;
  /** Offset from anchor to top-left of popover (e.g. cursor + nudge). */
  offsetX: number;
  offsetY: number;
  margin: number;
};

export type TooltipClampResult = { left: number; top: number };

/**
 * Keeps a fixed-position popover fully inside the viewport, preferring below-right
 * of the anchor and flipping above / left when needed.
 */
export function clampTooltipToViewport(
  args: TooltipClampArgs,
): TooltipClampResult {
  const {
    popW,
    popH,
    vw,
    vh,
    anchorX,
    anchorY,
    offsetX,
    offsetY,
    margin,
  } = args;

  let left = anchorX + offsetX;
  let top = anchorY + offsetY;

  const maxLeft = vw - margin - popW;
  const minLeft = margin;
  if (left > maxLeft) left = maxLeft;
  if (left < minLeft) left = minLeft;

  const maxTop = vh - margin - popH;
  const minTop = margin;
  if (top > maxTop) {
    const above = anchorY - offsetY - popH;
    top = above >= minTop ? above : maxTop;
  }
  if (top < minTop) top = minTop;

  return { left, top };
}

/**
 * Map a Y coordinate inside the textarea's content box (padding excluded, scroll included)
 * to a zero-based line index. Uses half-open intervals [i*lh, (i+1)*lh).
 * Y values outside the text block clamp to the nearest line so light taps and
 * browser hit-test jitter still resolve (important on mobile).
 */
export function lineIndexFromContentY(
  yIn: number,
  lineHeightPx: number,
  lineCount: number,
): number | null {
  if (lineCount <= 0) return null;
  if (!Number.isFinite(yIn) || !Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
    return null;
  }
  const maxY = lineCount * lineHeightPx;
  const clampedY = Math.min(Math.max(0, yIn), maxY - 1e-6);
  const idx = Math.floor(clampedY / lineHeightPx);
  return Math.max(0, Math.min(lineCount - 1, idx));
}

/** Zero-based line index for a caret offset inside draft text. */
export function lineIndexFromCaretOffset(text: string, offset: number): number {
  if (!text.length) return 0;
  const clamped = Math.max(0, Math.min(offset, text.length));
  return text.slice(0, clamped).split("\n").length - 1;
}

export const LINE_FEEDBACK_MARK_ATTR = "data-line-feedback-index";

export type HighlightMarkBounds = {
  lineIdx: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function pointInHighlightBounds(
  clientX: number,
  clientY: number,
  bounds: Pick<HighlightMarkBounds, "left" | "top" | "right" | "bottom">,
): boolean {
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

/**
 * Return the line index whose feedback `<mark>` contains the viewport point,
 * or null when the point is outside every highlight. When rects overlap, the
 * smallest area wins (most specific target).
 */
export function lineIndexAtHighlightPoint(
  marks: HighlightMarkBounds[],
  clientX: number,
  clientY: number,
): number | null {
  let best: { lineIdx: number; area: number } | null = null;
  for (const mark of marks) {
    if (!pointInHighlightBounds(clientX, clientY, mark)) continue;
    const area = (mark.right - mark.left) * (mark.bottom - mark.top);
    if (!best || area < best.area) {
      best = { lineIdx: mark.lineIdx, area };
    }
  }
  return best?.lineIdx ?? null;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Best-effort caret index for a viewport point inside a `<textarea>`.
 * Falls back to `null` when the browser does not expose a usable mapping.
 */
export function caretOffsetAtViewportPoint(
  el: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number | null {
  const r = el.getBoundingClientRect();
  if (
    clientX < r.left ||
    clientX > r.right ||
    clientY < r.top ||
    clientY > r.bottom
  ) {
    return null;
  }

  const doc = el.ownerDocument;
  type DocWithCaret = Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const d = doc as DocWithCaret;

  if (typeof d.caretPositionFromPoint === "function") {
    const p = d.caretPositionFromPoint(clientX, clientY);
    if (p && p.offsetNode === el && typeof p.offset === "number") {
      return clampInt(p.offset, 0, el.value.length);
    }
  }

  if (typeof d.caretRangeFromPoint === "function") {
    const range = d.caretRangeFromPoint(clientX, clientY);
    if (!range) return null;
    if (range.startContainer === el && typeof range.startOffset === "number") {
      return clampInt(range.startOffset, 0, el.value.length);
    }
    const sc = range.startContainer;
    if (
      sc.nodeType === Node.TEXT_NODE &&
      sc.parentNode === el &&
      typeof range.startOffset === "number"
    ) {
      return clampInt(range.startOffset, 0, el.value.length);
    }
  }

  return null;
}
