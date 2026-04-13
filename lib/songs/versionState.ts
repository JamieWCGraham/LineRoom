import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import {
  chatMessageSchema,
  critiqueResultSchema,
  draftRecordingMetaSchema,
} from "@/lib/validators";
import type { SongVersionRow } from "@/types/database";

const emptyMeta: CritiqueMeta = {
  title: "",
  similarArtists: "",
  genre: "",
};

function parseChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    const p = chatMessageSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseCritique(raw: unknown): CritiqueResult | null {
  const p = critiqueResultSchema.safeParse(raw);
  return p.success ? p.data : null;
}

function parseDraftRecordings(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.flatMap((item) => {
    const p = draftRecordingMetaSchema.safeParse(item);
    return p.success ? [p.data] : [];
  });
  return out.length ? out : undefined;
}

function parseMeta(raw: unknown): CritiqueMeta {
  if (!raw || typeof raw !== "object") return emptyMeta;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const similarArtists =
    typeof o.similarArtists === "string" ? o.similarArtists : "";
  const genre = typeof o.genre === "string" ? o.genre : "";
  const draftRecordings = parseDraftRecordings(o.draftRecordings);
  return { title, similarArtists, genre, draftRecordings };
}

export function versionStateFromRow(
  row: Pick<
    SongVersionRow,
    | "draft_text"
    | "brainstorm_text"
    | "chat_messages"
    | "critique"
    | "meta"
  >,
): {
  draftText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
} {
  return {
    draftText: row.draft_text,
    brainstormText:
      typeof row.brainstorm_text === "string" ? row.brainstorm_text : "",
    chatMessages: parseChatMessages(row.chat_messages),
    critique: parseCritique(row.critique),
    meta: parseMeta(row.meta),
  };
}
