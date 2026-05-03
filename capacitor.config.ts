import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Remote-URL shell: the WebView loads your deployed Next app (or dev URL).
 * Set CAPACITOR_SERVER_URL before `cap sync`, or rely on NEXT_PUBLIC_APP_URL /
 * NEXT_PUBLIC_SITE_URL if present in the environment (e.g. `export` or CI).
 *
 * Cleartext HTTP: enabled when URL is http:// or CAPACITOR_CLEARTEXT=true (local dev only).
 *
 * Optional: CAPACITOR_ALLOW_NAVIGATION=comma,separated,host.patterns for OAuth/Stripe
 * flows that must stay in the WebView (see Capacitor server.allowNavigation).
 */
function allowNavigationFromEnv(): string[] | undefined {
  const raw = process.env.CAPACITOR_ALLOW_NAVIGATION?.trim();
  if (!raw) return undefined;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

const serverUrlRaw =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  undefined;

const serverUrl = serverUrlRaw?.replace(/\/$/, "");

const cleartext =
  process.env.CAPACITOR_CLEARTEXT === "true" ||
  (serverUrl?.startsWith("http://") ?? false);

const allowNavigation = allowNavigationFromEnv();

const config: CapacitorConfig = {
  appId: "com.phasespace.lineroom",
  appName: "LineRoom",
  webDir: "capacitor-shell",
  ios: {
    contentInset: "automatic",
    /** Survives remote-URL loads: billing code + API routes match this token in `User-Agent`. */
    appendUserAgent: "LineRoomNativeShell/iOS",
  },
};

if (serverUrl) {
  config.server = {
    url: serverUrl,
    cleartext,
    ...(allowNavigation?.length ? { allowNavigation } : {}),
  };
}

export default config;
