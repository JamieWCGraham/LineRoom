import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";

export type SongDocumentPayload = {
  draft_text: string;
  brainstorm_text: string;
  chat_messages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
};

export type PersistSongStateResult =
  | { ok: true; newSubRevision: number }
  | {
      ok: false;
      reason?: "stale" | "locked" | "aborted" | "missing";
      message?: string;
      currentSubRevision?: number;
    };

export type PersistAbortReason =
  | "locked"
  | "paused"
  | "version switched"
  | "aborted"
  | "missing";
