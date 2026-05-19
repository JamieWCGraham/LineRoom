"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateSongVersionState } from "@/lib/songs/actions";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import {
  AUTOSAVE_DEBOUNCE_MS,
  buildAutosavePayloadString,
  chainPersist,
  scheduleDebouncedFlush,
  shouldAbortAfterPersist,
  shouldEnqueueFlush,
  shouldSkipPersist,
  songVersionCacheKey,
} from "@/lib/songs/persist";

export type UseSongPersistArgs = {
  enabled: boolean;
  songId: string | null;
  activeVersionId: string | null;
  serverSubRevision: number;
  onServerSubRevision: (n: number) => void;
  draftText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
  /** Bump when mobile pane / lyric doc pane changes to flush immediately. */
  flushTrigger?: unknown;
};

export type UseSongPersistResult = {
  autosavePayload: string;
  persistInFlight: boolean;
  autosaveError: string | null;
  flushPersist: () => void;
  waitForPersistChain: () => Promise<void>;
  markLastPersisted: (payloadStr: string) => void;
  persistSongState: (
    nextCritique?: CritiqueResult | null,
  ) => Promise<
    | { ok: true; newSubRevision: number }
    | { ok: false; message?: string; reason?: string; currentSubRevision?: number }
  >;
  setVersionRowPersistLock: (locked: boolean) => void;
  setPersistPaused: (paused: boolean) => void;
  setAutosaveError: (message: string | null) => void;
};

export function useSongPersist(args: UseSongPersistArgs): UseSongPersistResult {
  const {
    enabled,
    songId,
    activeVersionId,
    serverSubRevision,
    onServerSubRevision,
    draftText,
    brainstormText,
    chatMessages,
    critique,
    meta,
    flushTrigger,
  } = args;

  const [persistInFlightCount, setPersistInFlightCount] = useState(0);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);

  const activeVersionIdRef = useRef<string | null>(null);
  const versionRowPersistLockRef = useRef(false);
  const serverSubRevisionRef = useRef(serverSubRevision);
  const lastPersistedPayloadRef = useRef<string | null>(null);
  const persistPausedRef = useRef(false);
  const latestPayloadRef = useRef("");
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChainRef = useRef(Promise.resolve());

  const autosavePayload = buildAutosavePayloadString({
    draftText,
    brainstormText,
    chatMessages,
    critique,
    meta,
  });

  useEffect(() => {
    activeVersionIdRef.current = activeVersionId;
  }, [activeVersionId]);

  useEffect(() => {
    serverSubRevisionRef.current = serverSubRevision;
  }, [serverSubRevision]);

  useEffect(() => {
    latestPayloadRef.current = autosavePayload;
  }, [autosavePayload]);

  if (enabled && lastPersistedPayloadRef.current === null) {
    lastPersistedPayloadRef.current = autosavePayload;
  }

  const songLocalCacheKey =
    enabled && songId && activeVersionId ?
      songVersionCacheKey(songId, activeVersionId)
    : null;

  useEffect(() => {
    if (!songLocalCacheKey) return;
    try {
      localStorage.setItem(songLocalCacheKey, autosavePayload);
    } catch {
      /* ignore */
    }
  }, [autosavePayload, songLocalCacheKey]);

  const persistSongState = useCallback(
    async (nextCritique?: CritiqueResult | null) => {
      if (!enabled) {
        return {
          ok: false as const,
          message: "persistSongState called outside song mode",
        };
      }
      const refs = {
        versionRowPersistLock: versionRowPersistLockRef.current,
        persistPaused: persistPausedRef.current,
        activeVersionId: activeVersionIdRef.current,
        lastPersistedPayload: lastPersistedPayloadRef.current,
        latestPayload: latestPayloadRef.current,
      };
      const versionIdAtStart = activeVersionIdRef.current;
      const skip = shouldSkipPersist(refs, versionIdAtStart);
      if (skip) {
        return { ok: false as const, message: skip };
      }
      if (!songId || !versionIdAtStart) {
        return { ok: false as const, message: "missing" };
      }

      const payloadStr = buildAutosavePayloadString({
        draftText,
        brainstormText,
        chatMessages,
        critique: nextCritique === undefined ? critique : nextCritique,
        meta,
      });

      if (shouldSkipPersist(refs, versionIdAtStart)) {
        return { ok: false as const, message: "locked" };
      }

      const expected = serverSubRevisionRef.current;
      const result = await updateSongVersionState(
        songId,
        versionIdAtStart,
        {
          draft_text: draftText,
          brainstorm_text: brainstormText,
          chat_messages: chatMessages,
          critique: nextCritique === undefined ? critique : nextCritique,
          meta,
        },
        { expectedSubRevision: expected },
      );

      const afterRefs = {
        versionRowPersistLock: versionRowPersistLockRef.current,
        persistPaused: persistPausedRef.current,
        activeVersionId: activeVersionIdRef.current,
        lastPersistedPayload: lastPersistedPayloadRef.current,
        latestPayload: latestPayloadRef.current,
      };
      if (shouldAbortAfterPersist(afterRefs, versionIdAtStart)) {
        return { ok: false as const, message: "aborted" };
      }
      if (!result.ok) {
        if (result.reason === "stale") {
          persistPausedRef.current = true;
          if (typeof result.currentSubRevision === "number") {
            onServerSubRevision(result.currentSubRevision);
            serverSubRevisionRef.current = result.currentSubRevision;
          }
        }
        return result;
      }
      lastPersistedPayloadRef.current = payloadStr;
      onServerSubRevision(result.newSubRevision);
      serverSubRevisionRef.current = result.newSubRevision;
      return result;
    },
    [
      brainstormText,
      chatMessages,
      critique,
      draftText,
      enabled,
      meta,
      onServerSubRevision,
      songId,
    ],
  );

  const flushPersist = useCallback(() => {
    if (!enabled) return;
    void chainPersist(persistChainRef, async () => {
      const refs = {
        versionRowPersistLock: versionRowPersistLockRef.current,
        persistPaused: persistPausedRef.current,
        activeVersionId: activeVersionIdRef.current,
        lastPersistedPayload: lastPersistedPayloadRef.current,
        latestPayload: latestPayloadRef.current,
      };
      if (!shouldEnqueueFlush(refs)) return;

      setPersistInFlightCount((c) => c + 1);
      setAutosaveError(null);
      try {
        const result = await persistSongState();
        if (
          !result.ok &&
          result.message !== "aborted" &&
          result.message !== "locked"
        ) {
          if ("message" in result && result.message) {
            setAutosaveError(result.message);
          }
        } else {
          setAutosaveError(null);
        }
      } catch {
        setAutosaveError("Could not reach the server to save.");
      } finally {
        setPersistInFlightCount((c) => c - 1);
      }
    });
  }, [enabled, persistSongState]);

  useEffect(() => {
    if (!enabled) return;
    if (!shouldEnqueueFlush({
      versionRowPersistLock: versionRowPersistLockRef.current,
      persistPaused: persistPausedRef.current,
      activeVersionId: activeVersionIdRef.current,
      lastPersistedPayload: lastPersistedPayloadRef.current,
      latestPayload: latestPayloadRef.current,
    })) {
      return;
    }
    return scheduleDebouncedFlush(
      persistDebounceRef,
      () => void flushPersist(),
      AUTOSAVE_DEBOUNCE_MS,
    );
  }, [autosavePayload, enabled, flushPersist]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") void flushPersist();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, flushPersist]);

  useEffect(() => {
    if (!enabled) return;
    void flushPersist();
  }, [enabled, flushPersist, flushTrigger]);

  const setVersionRowPersistLock = useCallback((locked: boolean) => {
    versionRowPersistLockRef.current = locked;
  }, []);

  const setPersistPaused = useCallback((paused: boolean) => {
    persistPausedRef.current = paused;
  }, []);

  const waitForPersistChain = useCallback(() => {
    return new Promise<void>((resolve) => {
      persistChainRef.current = persistChainRef.current.then(() => {
        resolve();
      });
    });
  }, []);

  const markLastPersisted = useCallback((payloadStr: string) => {
    lastPersistedPayloadRef.current = payloadStr;
  }, []);

  return {
    autosavePayload,
    persistInFlight: persistInFlightCount > 0,
    autosaveError,
    flushPersist,
    waitForPersistChain,
    markLastPersisted,
    persistSongState,
    setVersionRowPersistLock,
    setPersistPaused,
    setAutosaveError,
  };
}
