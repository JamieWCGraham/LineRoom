/** sessionStorage key — one automatic reload per tab session to recover stale webpack chunks. */
export const CHUNK_RELOAD_ATTEMPT_KEY = "lineroom:chunk-reload-attempt";

const CHUNK_MESSAGE_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Failed to load module script/i,
  /Cannot read properties of undefined \(reading 'call'\)/,
] as const;

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(error ?? "");
}

function stackFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.stack ?? "";
  return "";
}

/** True when webpack/Next failed to load a route or lazy chunk (often after deploy or bfcache resume). */
export function isChunkLoadFailure(error: unknown): boolean {
  const message = messageFromUnknown(error);
  if (CHUNK_MESSAGE_PATTERNS.some((re) => re.test(message))) return true;

  const stack = stackFromUnknown(error);
  if (
    /reading 'call'/.test(message) &&
    /webpack-[a-f0-9]+\.js/i.test(stack)
  ) {
    return true;
  }

  return false;
}

export function clearChunkReloadAttempt(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_ATTEMPT_KEY);
  } catch {
    /* private mode / disabled storage */
  }
}

/** Reload once per tab session so a hard refresh picks up the current deployment's chunks. */
export function reloadOnceForStaleChunks(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_ATTEMPT_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_ATTEMPT_KEY, "1");
  } catch {
    window.location.reload();
    return true;
  }
  window.location.reload();
  return true;
}

export function handleChunkLoadFailure(error: unknown): void {
  if (!isChunkLoadFailure(error)) return;
  reloadOnceForStaleChunks();
}
