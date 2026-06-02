import type { SupabaseClient } from "@supabase/supabase-js";
import type { SongRow, SongVersionRow } from "@/types/database";

export type DashboardSong = Pick<SongRow, "id" | "title" | "updated_at"> & {
  latestVersionNumber: number | null;
  overallRatingBand: string | null;
  momentumLabel: string | null;
  momentumTone: "up" | "down" | "flat" | null;
  genres: string[];
  latestDraftText: string | null;
};

type VersionSlice = Pick<
  SongVersionRow,
  "version_number" | "critique" | "meta" | "draft_text"
>;

type RpcVersionRow = {
  song_id: string;
  version_number: number;
  critique: SongVersionRow["critique"];
  meta: SongVersionRow["meta"];
  draft_text: string;
};

const bandRank: Record<string, number> = {
  "Needs Work": 1,
  Promising: 2,
  Strong: 3,
  Standout: 4,
};

export function parseCommaSeparatedGenres(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

export function parseOverallRatingBand(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as { overallRatingBand?: unknown }).overallRatingBand;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function relativeTimeFromNow(value: string): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Math.max(0, Date.now() - t);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function getMomentum(
  latestBand: string | null,
  priorBand: string | null,
  updatedAt: string,
): { label: string | null; tone: "up" | "down" | "flat" | null } {
  if (!latestBand || !priorBand) return { label: null, tone: null };
  const latestRank = bandRank[latestBand] ?? 0;
  const priorRank = bandRank[priorBand] ?? 0;
  if (!latestRank || !priorRank) return { label: null, tone: null };
  const age = relativeTimeFromNow(updatedAt);
  if (latestRank > priorRank) {
    return { label: `▲ from ${priorBand}${age ? ` · ${age}` : ""}`, tone: "up" };
  }
  if (latestRank < priorRank) {
    return { label: `▼ from ${priorBand}${age ? ` · ${age}` : ""}`, tone: "down" };
  }
  return { label: null, tone: null };
}

function buildLatestTwoBySong(
  rows: ({ song_id: string } & VersionSlice)[],
): Map<string, VersionSlice[]> {
  const bySong = new Map<string, VersionSlice[]>();
  for (const row of rows) {
    const arr = bySong.get(row.song_id) ?? [];
    arr.push({
      version_number: row.version_number,
      critique: row.critique,
      meta: row.meta,
      draft_text: row.draft_text,
    });
    bySong.set(row.song_id, arr);
  }
  for (const [songId, arr] of bySong) {
    arr.sort((a, b) => Number(b.version_number) - Number(a.version_number));
    bySong.set(songId, arr.slice(0, 2));
  }
  return bySong;
}

function mapSongsWithVersions(
  songsBase: Pick<SongRow, "id" | "title" | "updated_at">[],
  latestTwoBySong: Map<string, VersionSlice[]>,
): DashboardSong[] {
  return songsBase.map((song) => {
    const [latest, prior] = latestTwoBySong.get(song.id) ?? [];
    const latestBand = parseOverallRatingBand(latest?.critique);
    const priorBand = parseOverallRatingBand(prior?.critique);
    const momentum = getMomentum(latestBand, priorBand, song.updated_at);
    return {
      ...song,
      latestVersionNumber:
        typeof latest?.version_number === "number" ? latest.version_number : null,
      overallRatingBand: latestBand,
      momentumLabel: momentum.label,
      momentumTone: momentum.tone,
      genres: parseCommaSeparatedGenres((latest?.meta as { genre?: unknown })?.genre),
      latestDraftText:
        typeof latest?.draft_text === "string" ? latest.draft_text : null,
    };
  });
}

async function fetchRecentVersionsLegacy(
  supabase: SupabaseClient,
  songIds: string[],
): Promise<Map<string, VersionSlice[]>> {
  const { data: versionRowsRaw } = await supabase
    .from("song_versions")
    .select("song_id, version_number, critique, meta, draft_text")
    .in("song_id", songIds)
    .order("version_number", { ascending: false });

  const rows = (versionRowsRaw ?? []) as Pick<
    SongVersionRow,
    "song_id" | "version_number" | "critique" | "meta" | "draft_text"
  >[];

  return buildLatestTwoBySong(rows);
}

async function fetchRecentVersionsRpc(
  supabase: SupabaseClient,
  songIds: string[],
): Promise<Map<string, VersionSlice[]> | null> {
  const { data, error } = await supabase.rpc("get_dashboard_recent_versions", {
    p_song_ids: songIds,
  });

  if (error) {
    return null;
  }

  const rows = (data ?? []) as RpcVersionRow[];
  return buildLatestTwoBySong(rows);
}

/** Loads dashboard piece rows for the signed-in user. */
export async function loadDashboardSongs(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardSong[]> {
  const { data: songsRaw } = await supabase
    .from("songs")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const songsBase = (songsRaw ?? []) as Pick<SongRow, "id" | "title" | "updated_at">[];
  const songIds = songsBase.map((s) => s.id);

  if (songIds.length === 0) {
    return [];
  }

  const latestTwoBySong =
    (await fetchRecentVersionsRpc(supabase, songIds)) ??
    (await fetchRecentVersionsLegacy(supabase, songIds));

  return mapSongsWithVersions(songsBase, latestTwoBySong);
}
