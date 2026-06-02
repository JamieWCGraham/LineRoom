import Link from "next/link";
import { PiecesBrowser } from "@/components/dashboard/pieces-browser";
import { DashboardSectionHeading } from "@/components/dashboard/dashboard-section-heading";
import { PieceListLogoMark } from "@/components/dashboard/piece-list-logo-mark";
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

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
          <DashboardSectionHeading
            title="Continue Working"
            action={
              <a
                href="#your-pieces"
                className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
              >
                View all pieces →
              </a>
            }
          />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {continueSongs.map((song) => (
              <article
                key={song.id}
                className="flex min-w-0 flex-col gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 md:flex-row md:items-center"
              >
                <PieceListLogoMark variant="featured" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-zinc-100">
                    {song.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Updated {formatUpdatedAt(song.updated_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {song.overallRatingBand ?
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${overallBandClassName(song.overallRatingBand)}`}
                      >
                        {song.overallRatingBand}
                      </span>
                    : null}
                    {song.latestVersionNumber ?
                      <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                        v{song.latestVersionNumber}
                      </span>
                    : null}
                  </div>
                  {song.genres.length > 0 ?
                    <p className="mt-2 truncate text-xs text-zinc-500">
                      Genres: {song.genres.join(" · ")}
                    </p>
                  : null}
                </div>
                <Link
                  href={`/song/${song.id}`}
                  prefetch
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 md:self-center"
                >
                  <PencilIcon />
                  Open draft
                </Link>
              </article>
            ))}
          </div>
        </section>
      : null}

      <section
        id="your-pieces"
        className="mt-0 scroll-mt-8 px-4 pb-8 md:mt-10 md:px-0 md:pb-0"
      >
        <PiecesBrowser songs={songs} mobileNav={{ email, showEvalsNav }} />
      </section>
    </>
  );
}
