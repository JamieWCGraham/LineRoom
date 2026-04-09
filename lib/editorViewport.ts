import type { Viewport } from "next";

/**
 * Used on song + lineroom editor routes so mobile Safari does not pinch-zoom
 * away from the layout after the keyboard opens, and the layout viewport
 * resizes predictably when the keyboard shows (Android).
 */
export const lineroomEditorViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
