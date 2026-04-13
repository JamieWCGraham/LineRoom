import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidSegment } from "@/lib/draft-recordings/storagePath";

type AuthUser = { id: string };

/**
 * Validates object path and ownership.
 *
 * **Current layout:** `{userId}/{songId}/{versionId}/{filename}`
 *
 * **Legacy:** `{userId}/{songId}/{filename}` (no version segment), or older
 * `{emailFolder}/{songId}/{versionId}/{filename}` (first segment is not a UUID).
 */
export async function assertRecordingObjectAccess(
  supabase: SupabaseClient,
  user: AuthUser,
  objectPath: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const trimmed = objectPath.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/")) {
    return { ok: false, status: 400, message: "Invalid path." };
  }
  const parts = trimmed.split("/").filter(Boolean);
  const userId = user.id;

  if (parts.length === 4) {
    const [p0, songId, versionId, fileName] = parts;
    if (!fileName || fileName.includes("/")) {
      return { ok: false, status: 400, message: "Invalid path." };
    }
    if (!p0 || p0.length > 256 || p0.includes("/")) {
      return { ok: false, status: 400, message: "Invalid path." };
    }
    if (isUuidSegment(p0) && p0 !== userId) {
      return { ok: false, status: 403, message: "Forbidden." };
    }
    if (!isUuidSegment(songId) || !isUuidSegment(versionId)) {
      return { ok: false, status: 400, message: "Invalid path." };
    }

    const { data: version, error: vErr } = await supabase
      .from("song_versions")
      .select("id, song_id")
      .eq("id", versionId)
      .eq("song_id", songId)
      .maybeSingle();

    if (vErr || !version) {
      return { ok: false, status: 404, message: "Version not found." };
    }

    const { data: song, error: sErr } = await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sErr || !song) {
      return { ok: false, status: 403, message: "Forbidden." };
    }

    return { ok: true };
  }

  if (parts.length === 3) {
    const [seg0, songId, fileName] = parts;
    if (!fileName || fileName.includes("/")) {
      return { ok: false, status: 400, message: "Invalid path." };
    }
    if (seg0 !== userId || !isUuidSegment(songId)) {
      return { ok: false, status: 403, message: "Forbidden." };
    }

    const { data: song, error: sErr } = await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sErr || !song) {
      return { ok: false, status: 403, message: "Forbidden." };
    }

    return { ok: true };
  }

  return { ok: false, status: 400, message: "Invalid path shape." };
}
