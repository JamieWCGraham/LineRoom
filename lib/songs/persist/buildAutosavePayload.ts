import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import type { SongDocumentPayload } from "./types";

export function buildSongDocumentPayload(input: {
  draftText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
}): SongDocumentPayload {
  return {
    draft_text: input.draftText,
    brainstorm_text: input.brainstormText,
    chat_messages: input.chatMessages,
    critique: input.critique,
    meta: input.meta,
  };
}

/** Canonical JSON string for autosave comparison and localStorage cache. */
export function serializeAutosavePayload(payload: SongDocumentPayload): string {
  return JSON.stringify({
    draft_text: payload.draft_text,
    brainstorm_text: payload.brainstorm_text,
    chat_messages: payload.chat_messages,
    critique: payload.critique,
    meta: payload.meta,
  });
}

export function buildAutosavePayloadString(input: {
  draftText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
}): string {
  return serializeAutosavePayload(buildSongDocumentPayload(input));
}

export function songVersionCacheKey(
  songId: string,
  versionId: string,
): string {
  return `lineroom_song_version_cache_${songId}_${versionId}`;
}
