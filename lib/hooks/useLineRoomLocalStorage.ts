"use client";

import { useEffect } from "react";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import {
  LOCAL_STORAGE_KEYS,
  parseCritiqueFromStorage,
  parseMetaFromStorage,
} from "@/lib/songs/persist";

export function useLineRoomLocalStorage(args: {
  enabled: boolean;
  fullText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
  setFullText: (v: string) => void;
  setBrainstormText: (v: string) => void;
  setChatMessages: (v: ChatMessage[]) => void;
  setCritique: (v: CritiqueResult | null) => void;
  setMeta: (v: CritiqueMeta) => void;
}) {
  const {
    enabled,
    fullText,
    brainstormText,
    chatMessages,
    critique,
    meta,
    setFullText,
    setBrainstormText,
    setChatMessages,
    setCritique,
    setMeta,
  } = args;

  useEffect(() => {
    if (!enabled) return;
    try {
      const d = localStorage.getItem(LOCAL_STORAGE_KEYS.draft);
      const c = localStorage.getItem(LOCAL_STORAGE_KEYS.chat);
      const cr = localStorage.getItem(LOCAL_STORAGE_KEYS.critique);
      const m = localStorage.getItem(LOCAL_STORAGE_KEYS.meta);
      if (d !== null) setFullText(d);
      const b = localStorage.getItem(LOCAL_STORAGE_KEYS.brainstorm);
      if (b !== null) setBrainstormText(b);
      if (c !== null) {
        const parsed = JSON.parse(c) as unknown;
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(
            (msg): msg is ChatMessage =>
              typeof msg === "object" &&
              msg !== null &&
              (msg.role === "user" || msg.role === "assistant") &&
              typeof msg.content === "string",
          );
          setChatMessages(restored);
        }
      }
      setCritique(parseCritiqueFromStorage(cr));
      setMeta(parseMetaFromStorage(m));
    } catch {
      /* ignore */
    }
  }, [enabled, setBrainstormText, setChatMessages, setCritique, setFullText, setMeta]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.draft, fullText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, fullText]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.brainstorm, brainstormText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, brainstormText]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.chat,
          JSON.stringify(chatMessages),
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, chatMessages]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        if (critique) {
          localStorage.setItem(
            LOCAL_STORAGE_KEYS.critique,
            JSON.stringify(critique),
          );
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.critique);
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, critique]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.meta, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, meta]);
}
