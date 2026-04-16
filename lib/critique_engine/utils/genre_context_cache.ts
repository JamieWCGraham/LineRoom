import type { GenreContextOutput } from "@/lib/critique_engine/schemas/genre_context";
import type { CritiqueRequestPayload } from "@/lib/prompts";

const MAX_ENTRIES = 80;

const cache = new Map<string, { at: number; value: GenreContextOutput }>();
const TTL_MS = 60 * 60 * 1000;

function cacheKey(payload: CritiqueRequestPayload): string {
  return JSON.stringify({
    g: payload.genre?.trim() ?? "",
    a: payload.similarArtists?.trim() ?? "",
    t: payload.title?.trim() ?? "",
    x: payload.fullText.slice(0, 400),
  });
}

export function getCachedGenreContext(
  payload: CritiqueRequestPayload,
): GenreContextOutput | undefined {
  const k = cacheKey(payload);
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(k);
    return undefined;
  }
  return hit.value;
}

export function setCachedGenreContext(
  payload: CritiqueRequestPayload,
  value: GenreContextOutput,
): void {
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey(payload), { at: Date.now(), value });
}
