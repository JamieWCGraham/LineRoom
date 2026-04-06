"use client";

type Props = {
  similarArtists: string;
  genre: string;
  onSimilarArtistsChange: (v: string) => void;
  onGenreChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
  lyricsEmpty: boolean;
};

export function CritiqueSetupPanel({
  similarArtists,
  genre,
  onSimilarArtistsChange,
  onGenreChange,
  onGenerate,
  loading,
  error,
  lyricsEmpty,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="border-b border-zinc-800/80 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Before the critique
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
          Add context so the critique can use genre craft and your reference
          points.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            What writers or artists are close to this voice (lyrics/poetry)?
          </span>
          <textarea
            value={similarArtists}
            onChange={(e) => onSimilarArtistsChange(e.target.value)}
            disabled={loading}
            rows={3}
            className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
            placeholder="Names or short notes on tone, era, scene…"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            What is the genre of the piece?
          </span>
          <input
            type="text"
            value={genre}
            onChange={(e) => onGenreChange(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
            placeholder="e.g. indie folk, spoken word, sonnet, UK drill…"
          />
        </label>
      </div>

      {error ? (
        <div
          className="mx-3 mb-2 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="border-t border-zinc-800/80 p-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || lyricsEmpty}
          className="w-full rounded-lg bg-amber-700/90 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Generating…" : "Generate Critique"}
        </button>
        {lyricsEmpty ? (
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Add lyrics or poetry in the draft to enable critique.
          </p>
        ) : null}
      </div>
    </div>
  );
}
