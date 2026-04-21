import { describe, it, expect } from "vitest";
import {
  clampTooltipToViewport,
  lineIndexFromContentY,
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
