import type { Viewport } from "next";

/**
 * Default for all routes: paint into notch / home-indicator safe areas so iOS
 * does not letterbox with the system default (white). Editor layouts export a
 * stricter viewport that still includes `viewportFit: "cover"`.
 */
export const lineroomRootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};
