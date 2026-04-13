import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDraftRecordingsBucket } from "./bucket";

const PAGE = 100;

function looksLikeAudioObject(name: string): boolean {
  return /\.(webm|m4a|mp3|wav|bin|mp4|ogg)$/i.test(name);
}

async function collectAllObjectPaths(
  service: SupabaseClient,
  bucket: string,
  prefix: string,
  out: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  let offset = 0;
  for (;;) {
    const { data, error } = await service.storage.from(bucket).list(prefix, {
      limit: PAGE,
      offset,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data?.length) break;

    for (const item of data) {
      if (!item.name || item.name.includes("/")) continue;
      const child = `${prefix}/${item.name}`;
      if (looksLikeAudioObject(item.name)) {
        out.push(child);
      } else {
        const sub = await collectAllObjectPaths(service, bucket, child, out);
        if (!sub.ok) return sub;
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return { ok: true };
}

async function removePaths(
  service: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const { error } = await service.storage.from(bucket).remove(chunk);
    if (error) {
      console.error(
        "[draft-recordings] remove failed during song delete cleanup:",
        error.message,
      );
    }
  }
}

/**
 * Deletes all voice memo objects under `{userId}/{songId}/**` (flat legacy files
 * and nested `{versionId}/` folders). Paths from `meta` are also removed via
 * `removeExplicitRecordingPaths` for older email-prefixed keys.
 */
export async function removeDraftRecordingsForSong(
  userId: string,
  songId: string,
): Promise<void> {
  const uid = userId.trim();
  const sid = songId.trim();
  if (!uid || !sid) return;

  let service: SupabaseClient;
  try {
    service = createServiceRoleClient();
  } catch {
    return;
  }

  const bucket = getDraftRecordingsBucket();
  const root = `${uid}/${sid}`;
  const paths: string[] = [];

  const result = await collectAllObjectPaths(service, bucket, root, paths);
  if (!result.ok) {
    console.error(
      "[draft-recordings] list failed during song delete cleanup:",
      result.message,
    );
  }

  await removePaths(service, bucket, paths);
}

/** Removes specific object keys (e.g. paths read from `song_versions.meta` before delete). */
export async function removeExplicitRecordingPaths(
  paths: Iterable<string>,
): Promise<void> {
  const unique = [...new Set(paths)].map((p) => p.trim()).filter(Boolean);
  if (unique.length === 0) return;

  let service: SupabaseClient;
  try {
    service = createServiceRoleClient();
  } catch {
    return;
  }

  const bucket = getDraftRecordingsBucket();
  await removePaths(service, bucket, unique);
}
