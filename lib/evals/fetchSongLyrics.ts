const LRCLIB_UA = "LineRoom/1.0 (https://github.com/phasespacestudio/lineroom; eval-lyrics)";

const ARTIST_CLEANUPS: Array<[RegExp, string]> = [
  [/ ft\. /gi, " "],
  [/ feat\. /gi, " "],
  [/ featuring /gi, " "],
];

export function normalizeArtistForSearch(artist: string): string {
  let current = artist;
  for (const [pattern, replacement] of ARTIST_CLEANUPS) {
    current = current.replace(pattern, replacement);
  }
  return current.split(",")[0]!.trim();
}

export function titleVariants(title: string): string[] {
  const variants = new Set<string>([title]);
  variants.add(
    title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim(),
  );
  variants.add(title.replaceAll("’", "'"));
  variants.add(title.replace(/\?/g, "").trim());
  return Array.from(variants).filter(Boolean);
}

type LrclibHit = {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

async function fetchLyricsFromLyricsOvh(
  title: string,
  artist: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { lyrics?: string };
    if (data?.lyrics && typeof data.lyrics === "string" && data.lyrics.trim().length > 0) {
      return data.lyrics.trim();
    }
  } catch {
    /* try next */
  }
  return null;
}

async function fetchLyricsFromLrclibSearch(
  title: string,
  artist: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });
  const url = `https://lrclib.net/api/search?${params.toString()}`;
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": LRCLIB_UA },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    for (const item of data as LrclibHit[]) {
      const plain = item.plainLyrics?.trim();
      if (plain) return plain;
      const synced = item.syncedLyrics?.trim();
      if (synced) return synced.replace(/^\[\d{2}:\d{2}\.\d{2}\]\s*/gm, "").trim();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Fetches plain lyrics using lyrics.ovh, then LRCLIB search (no API keys).
 */
export async function fetchSongLyrics(
  title: string,
  artist: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const artistQuery = normalizeArtistForSearch(artist);
  const attempts: Array<{ title: string; artist: string }> = [];
  for (const candidateTitle of titleVariants(title)) {
    attempts.push({ title: candidateTitle, artist: artistQuery });
  }

  for (const attempt of attempts) {
    const ovh = await fetchLyricsFromLyricsOvh(attempt.title, attempt.artist, fetchImpl);
    if (ovh) return ovh;
    const lib = await fetchLyricsFromLrclibSearch(attempt.title, attempt.artist, fetchImpl);
    if (lib) return lib;
  }
  return null;
}
