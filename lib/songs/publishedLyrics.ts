import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicAppOrigin } from "@/lib/legal/urls";

export type PublishedLyrics = {
  title: string;
  draftText: string;
  publishedAt: string;
};

export function publishedLyricsUrl(token: string): string {
  const path = `/p/${token}`;
  const origin = getPublicAppOrigin();
  return origin ? `${origin}${path}` : path;
}

export function isValidShareToken(token: string): boolean {
  const trimmed = token.trim();
  return trimmed.length >= 16 && trimmed.length <= 64;
}

export async function fetchPublishedLyrics(
  supabase: Pick<SupabaseClient, "rpc">,
  token: string,
): Promise<PublishedLyrics | null> {
  if (!isValidShareToken(token)) return null;

  const { data, error } = await supabase.rpc("get_published_lyrics", {
    p_token: token.trim(),
  });

  if (error || data == null) return null;

  if (typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title : null;
  const draftText =
    typeof row.draft_text === "string" ? row.draft_text : null;
  const publishedAt =
    typeof row.published_at === "string" ? row.published_at : null;

  if (title == null || draftText == null || publishedAt == null) return null;

  return { title, draftText, publishedAt };
}
