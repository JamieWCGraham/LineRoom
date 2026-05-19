import type { PersistAbortReason } from "./types";

export const AUTOSAVE_DEBOUNCE_MS = 800;

export type PersistQueueRefs = {
  versionRowPersistLock: boolean;
  persistPaused: boolean;
  activeVersionId: string | null;
  lastPersistedPayload: string | null;
  latestPayload: string;
};

export function shouldSkipPersist(
  refs: PersistQueueRefs,
  versionIdAtStart: string | null,
): PersistAbortReason | null {
  if (refs.versionRowPersistLock) return "locked";
  if (!versionIdAtStart) return "missing";
  if (refs.persistPaused) return "paused";
  if (refs.activeVersionId !== versionIdAtStart) return "version switched";
  return null;
}

export function shouldAbortAfterPersist(
  refs: PersistQueueRefs,
  versionIdAtStart: string | null,
): boolean {
  if (refs.versionRowPersistLock) return true;
  if (refs.activeVersionId !== versionIdAtStart) return true;
  return false;
}

export function shouldEnqueueFlush(refs: PersistQueueRefs): boolean {
  if (refs.persistPaused || refs.versionRowPersistLock) return false;
  if (refs.latestPayload === refs.lastPersistedPayload) return false;
  return true;
}

/** Chain async persist work so concurrent flushes run sequentially. */
export function chainPersist<T>(
  chainRef: { current: Promise<void> },
  work: () => Promise<T>,
): Promise<T> {
  const next = chainRef.current.then(() => work());
  chainRef.current = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function clearDebounceTimer(
  timerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function scheduleDebouncedFlush(
  timerRef: { current: ReturnType<typeof setTimeout> | null },
  flush: () => void,
  delayMs: number = AUTOSAVE_DEBOUNCE_MS,
): () => void {
  clearDebounceTimer(timerRef);
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    flush();
  }, delayMs);
  return () => clearDebounceTimer(timerRef);
}
