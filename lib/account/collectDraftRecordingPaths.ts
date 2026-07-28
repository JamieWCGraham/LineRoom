import type { SupabaseClient } from "@supabase/supabase-js";
import { draftRecordingMetaSchema } from "@/lib/validators";

/**
 * Collects draft recording object paths from all of a user's song versions
 * (including legacy email-prefixed keys stored in `meta`).
 */
export async function collectDraftRecordingPathsFromUserSongs(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: songs, error: songsErr } = await admin
    .from("songs")
    .select("id")
    .eq("user_id", userId);

  if (songsErr || !songs?.length) {
    return [];
  }

  const songIds = songs.map((s) => s.id as string);
  const { data: versionRows, error: versionsErr } = await admin
    .from("song_versions")
    .select("meta")
    .in("song_id", songIds);

  if (versionsErr || !versionRows?.length) {
    return [];
  }

  const paths = new Set<string>();
  for (const row of versionRows) {
    const raw = row.meta;
    if (!raw || typeof raw !== "object") continue;
    const dr = (raw as { draftRecordings?: unknown }).draftRecordings;
    if (!Array.isArray(dr)) continue;
    for (const item of dr) {
      const p = draftRecordingMetaSchema.safeParse(item);
      if (p.success && p.data.objectPath.trim()) {
        paths.add(p.data.objectPath.trim());
      }
    }
  }

  return [...paths];
}
