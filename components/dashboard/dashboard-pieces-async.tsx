import Link from "next/link";
import { PiecesBrowser } from "@/components/dashboard/pieces-browser";
import { NewPieceButton } from "@/components/dashboard/new-piece-button";
import { PrefetchDashboardSongs } from "@/components/navigation/route-prefetch";
import type { DashboardSong } from "@/lib/songs/dashboardSongs";

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
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
  songs: DashboardSong[];
  email: string;
  showEvalsNav: boolean;
};

export function DashboardPieces({ songs, email, showEvalsNav }: Props) {
  const continueSongs = songs.slice(0, 2);

  return (
    <>
      <PrefetchDashboardSongs songIds={songs.map((s) => s.id)} />
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
                prefetch
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
        <PiecesBrowser songs={songs} mobileNav={{ email, showEvalsNav }} />
      </section>
    </>
  );
}
