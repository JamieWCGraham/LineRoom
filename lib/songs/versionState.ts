import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import {
  chatMessageSchema,
  critiqueMetaSchema,
  critiqueResultSchema,
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

function parseMeta(raw: unknown): CritiqueMeta {
  const p = critiqueMetaSchema.safeParse(raw);
  return p.success ? p.data : emptyMeta;
}

export function versionStateFromRow(
  row: Pick<
    SongVersionRow,
    "draft_text" | "chat_messages" | "critique" | "meta"
  >,
): {
  draftText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
} {
  return {
    draftText: row.draft_text,
    chatMessages: parseChatMessages(row.chat_messages),
    critique: parseCritique(row.critique),
    meta: parseMeta(row.meta),
  };
}
