import type { CritiqueMeta, CritiqueResult, DraftRecordingMeta } from "@/lib/types";
import { critiqueResultSchema } from "@/lib/validators";

export function parseCritiqueFromStorage(
  raw: string | null,
): CritiqueResult | null {
  if (raw === null) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    const p = critiqueResultSchema.safeParse(j);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

function parseLocalRecording(item: unknown): DraftRecordingMeta | null {
  if (typeof item !== "object" || item === null) return null;
  const r = item as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    typeof r.objectPath !== "string" ||
    typeof r.mimeType !== "string" ||
    typeof r.createdAt !== "string"
  ) {
    return null;
  }
  const rec: DraftRecordingMeta = {
    id: r.id,
    name: r.name,
    objectPath: r.objectPath,
    mimeType: r.mimeType,
    createdAt: r.createdAt,
  };
  if (typeof r.durationSec === "number") rec.durationSec = r.durationSec;
  return rec;
}

export function parseMetaFromStorage(raw: string | null): CritiqueMeta {
  const empty: CritiqueMeta = { title: "", similarArtists: "", genre: "" };
  if (raw === null) return empty;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const draftRecordings = Array.isArray(j.draftRecordings) ?
      j.draftRecordings
        .map(parseLocalRecording)
        .filter((x): x is DraftRecordingMeta => x !== null)
    : [];
    return {
      title: typeof j.title === "string" ? j.title : "",
      similarArtists:
        typeof j.similarArtists === "string" ? j.similarArtists : "",
      genre: typeof j.genre === "string" ? j.genre : "",
      draftRecordings:
        draftRecordings.length ? draftRecordings : undefined,
    };
  } catch {
    return empty;
  }
}

export const LOCAL_STORAGE_KEYS = {
  draft: "lineroom_draft",
  brainstorm: "lineroom_brainstorm",
  chat: "lineroom_chat_messages",
  critique: "lineroom_critique",
  meta: "lineroom_critique_meta",
} as const;
