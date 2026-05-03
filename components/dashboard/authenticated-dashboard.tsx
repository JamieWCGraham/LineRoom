import Link from "next/link";
import { AppBrandDash } from "@/components/app-brand";
import { NewPieceButton } from "@/components/dashboard/new-piece-button";
import { PiecesBrowser } from "@/components/dashboard/pieces-browser";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { isBillingBypassed } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";
import type { SongRow, SongVersionRow } from "@/types/database";

type DashboardSong = Pick<SongRow, "id" | "title" | "updated_at"> & {
  latestVersionNumber: number | null;
  overallRatingBand: string | null;
  momentumLabel: string | null;
  momentumTone: "up" | "down" | "flat" | null;
  genres: string[];
  latestDraftText: string | null;
};

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function parseCommaSeparatedGenres(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function parseOverallRatingBand(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as { overallRatingBand?: unknown }).overallRatingBand;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function relativeTimeFromNow(value: string): string {
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

const bandRank: Record<string, number> = {
  "Needs Work": 1,
  Promising: 2,
  Strong: 3,
  Standout: 4,
};

function getMomentum(
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

function overallBandClassName(band: string): string {
  if (band === "Needs Work") {
    return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  }
  if (band === "Promising") {
    return "border-sky-900/60 bg-sky-950/25 text-sky-200";
  }
  if (band === "Strong") {
    return "border-lime-800/70 bg-lime-950/25 text-lime-100";
  }
  if (band === "Standout") {
    return "border-emerald-900/70 bg-emerald-950/30 text-emerald-200";
  }
  return "border-zinc-700 text-zinc-300";
}

type Props = {
  userId: string;
  email: string;
  createError?: string;
};

export async function AuthenticatedDashboard({
  userId,
  email,
  createError,
}: Props) {
  const supabase = await createClient();

  const { data: songsRaw } = await supabase
    .from("songs")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const songsBase = (songsRaw ?? []) as Pick<SongRow, "id" | "title" | "updated_at">[];
  const songIds = songsBase.map((s) => s.id);

  const { data: versionRowsRaw } =
    songIds.length > 0 ?
      await supabase
        .from("song_versions")
        .select("song_id, version_number, critique, meta, draft_text")
        .in("song_id", songIds)
        .order("version_number", { ascending: false })
    : { data: [] as null | SongVersionRow[] };

  const latestTwoBySong = new Map<
    string,
    Pick<SongVersionRow, "version_number" | "critique" | "meta" | "draft_text">[]
  >();
  for (const row of (versionRowsRaw ?? []) as Pick<
    SongVersionRow,
    "song_id" | "version_number" | "critique" | "meta" | "draft_text"
  >[]) {
    const arr = latestTwoBySong.get(row.song_id) ?? [];
    if (arr.length < 2) {
      arr.push({
        version_number: row.version_number,
        critique: row.critique,
        meta: row.meta,
        draft_text: row.draft_text,
      });
      latestTwoBySong.set(row.song_id, arr);
    }
  }

  const songs: DashboardSong[] = songsBase.map((song) => {
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

  const continueSongs = songs.slice(0, 2);
  const showEvalsNav = isBillingBypassed(email);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-zinc-950 md:min-h-0 md:bg-transparent md:px-4 md:py-12">
      <div className="hidden md:block">
        <AppBrandDash />

        <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-zinc-200">{email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {showEvalsNav ?
              <Link
                href="/evals"
                className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-600/60 hover:bg-emerald-950/40"
              >
                Evals
              </Link>
            : null}
            <Link
              href="/account"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Account
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>

      {createError === "1" ?
        <p className="mx-4 mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:mx-0 md:mt-4">
          Could not create a new piece. Check your connection and try again.
        </p>
      : null}

      {continueSongs.length > 0 ?
        <section className="mt-8 hidden md:block">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Continue working on
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {continueSongs.map((song) => (
              <Link
                key={song.id}
                href={`/song/${song.id}`}
                className="group rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-[0_0_0_1px_rgba(120,119,198,0.22),0_0_24px_rgba(99,102,241,0.12)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-base font-semibold text-zinc-100">
                    {song.title}
                  </p>
                  <span className="rounded-md border border-zinc-600 px-2 py-0.5 text-[11px] font-medium text-zinc-300 group-hover:border-zinc-500 group-hover:text-zinc-100">
                    Resume
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Updated {formatUpdatedAt(song.updated_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {song.overallRatingBand ?
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${overallBandClassName(song.overallRatingBand)}`}
                    >
                      {song.overallRatingBand}
                    </span>
                  : null}
                  {song.latestVersionNumber ?
                    <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                      v{song.latestVersionNumber}
                    </span>
                  : null}
                  {song.momentumLabel ?
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${
                        song.momentumTone === "up"
                          ? "border-emerald-900/70 bg-emerald-950/30 text-emerald-200"
                          : song.momentumTone === "down"
                            ? "border-stone-700/80 bg-stone-950/40 text-stone-300"
                            : "border-zinc-700 text-zinc-300"
                      }`}
                    >
                      {song.momentumLabel}
                    </span>
                  : null}
                </div>
                {song.genres.length > 0 ?
                  <p className="mt-2 truncate text-[11px] text-zinc-500">
                    Genres: {song.genres.join(" · ")}
                  </p>
                : null}
              </Link>
            ))}
          </div>
        </section>
      : null}

      <section className="mt-0 px-4 pb-8 md:mt-10 md:px-0 md:pb-0">
        <div className="mb-3 hidden flex-wrap items-center gap-2 sm:gap-3 md:flex">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Your pieces
          </h2>
          <NewPieceButton />
        </div>
        <PiecesBrowser
          songs={songs}
          mobileNav={{ email, showEvalsNav }}
        />
      </section>
    </div>
  );
}
