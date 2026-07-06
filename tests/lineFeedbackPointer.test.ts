import { describe, it, expect } from "vitest";
import {
  clampTooltipToViewport,
  lineIndexAtHighlightPoint,
  lineIndexFromCaretOffset,
  lineIndexFromContentY,
  pointInHighlightBounds,
} from "@/lib/draft/lineFeedbackPointer";

describe("clampTooltipToViewport", () => {
  it("keeps the popover inside the viewport with default placement", () => {
    const r = clampTooltipToViewport({
      popW: 100,
      popH: 40,
      vw: 400,
      vh: 800,
      anchorX: 50,
      anchorY: 50,
      offsetX: 14,
      offsetY: 14,
      margin: 8,
    });
    expect(r.left).toBeGreaterThanOrEqual(8);
    expect(r.top).toBeGreaterThanOrEqual(8);
    expect(r.left + 100).toBeLessThanOrEqual(400 - 8);
    expect(r.top + 40).toBeLessThanOrEqual(800 - 8);
  });

  it("flips above the anchor when there is not enough room below", () => {
    const r = clampTooltipToViewport({
      popW: 120,
      popH: 200,
      vw: 360,
      vh: 400,
      anchorX: 40,
      anchorY: 360,
      offsetX: 12,
      offsetY: 12,
      margin: 8,
    });
    expect(r.top + 200).toBeLessThanOrEqual(400 - 8);
    expect(r.left).toBeGreaterThanOrEqual(8);
  });
});

describe("lineIndexFromContentY", () => {
  it("maps Y into line indices with half-open intervals", () => {
    expect(lineIndexFromContentY(0, 20, 5)).toBe(0);
    expect(lineIndexFromContentY(19.9, 20, 5)).toBe(0);
    expect(lineIndexFromContentY(20, 20, 5)).toBe(1);
    expect(lineIndexFromContentY(79.9, 20, 5)).toBe(3);
  });

  it("clamps out-of-range Y to the nearest line", () => {
    expect(lineIndexFromContentY(-1, 20, 5)).toBe(0);
    expect(lineIndexFromContentY(100, 20, 5)).toBe(4);
  });

  it("returns null for invalid inputs", () => {
    expect(lineIndexFromContentY(0, 0, 3)).toBeNull();
    expect(lineIndexFromContentY(0, 20, 0)).toBeNull();
  });
});

describe("lineIndexFromCaretOffset", () => {
  it("maps caret offsets to line indices", () => {
    const text = "line one\nline two\nline three";
    expect(lineIndexFromCaretOffset(text, 0)).toBe(0);
    expect(lineIndexFromCaretOffset(text, 8)).toBe(0);
    expect(lineIndexFromCaretOffset(text, 9)).toBe(1);
    expect(lineIndexFromCaretOffset(text, text.length)).toBe(2);
  });
});

describe("pointInHighlightBounds", () => {
  const bounds = { left: 10, top: 20, right: 110, bottom: 40 };

  it("returns true for points inside the rect", () => {
    expect(pointInHighlightBounds(50, 30, bounds)).toBe(true);
  });

  it("returns false for points outside the rect", () => {
    expect(pointInHighlightBounds(5, 30, bounds)).toBe(false);
    expect(pointInHighlightBounds(50, 45, bounds)).toBe(false);
  });
});

describe("lineIndexAtHighlightPoint", () => {
  const marks = [
    { lineIdx: 0, left: 0, top: 0, right: 100, bottom: 20 },
    { lineIdx: 1, left: 0, top: 24, right: 100, bottom: 44 },
    { lineIdx: 2, left: 0, top: 48, right: 60, bottom: 68 },
  ];

  it("returns the line index when the point is inside a mark", () => {
    expect(lineIndexAtHighlightPoint(marks, 50, 10)).toBe(0);
    expect(lineIndexAtHighlightPoint(marks, 50, 30)).toBe(1);
    expect(lineIndexAtHighlightPoint(marks, 40, 55)).toBe(2);
  });

  it("returns null when the point is outside all marks", () => {
    expect(lineIndexAtHighlightPoint(marks, 80, 55)).toBeNull();
    expect(lineIndexAtHighlightPoint(marks, 50, 22)).toBeNull();
  });

  it("prefers the smallest mark when rects overlap", () => {
    const overlapping = [
      { lineIdx: 0, left: 0, top: 0, right: 100, bottom: 40 },
      { lineIdx: 1, left: 0, top: 10, right: 50, bottom: 30 },
    ];
    expect(lineIndexAtHighlightPoint(overlapping, 25, 20)).toBe(1);
  });
});
