const highlight = {
  strong:
    "rounded px-1 py-0.5 font-medium text-white ring-1 ring-emerald-500/50 bg-emerald-600/50",
  promising:
    "rounded px-1 py-0.5 font-medium text-white ring-1 ring-sky-500/50 bg-blue-600/40",
  suggestion:
    "rounded px-1 py-0.5 font-medium text-white ring-1 ring-violet-400/55 bg-violet-600/40",
} as const;

type Props = {
  /** When true, omits outer marketing section wrapper (for use inside the hero card). */
  embedded?: boolean;
};

/**
 * Static marketing preview: four lyric lines, one suggestion-tier highlight, one feedback
 * block directly beneath it (no overlap) so highlight → feedback reads instantly.
 */
export function LandingLyricPreview({ embedded = false }: Props) {
  const draft = (
    <div className="w-full rounded-xl border border-zinc-700/90 bg-zinc-950 px-4 py-4 sm:px-5 sm:py-5">
      <div className="font-sans text-[16px] leading-[1.65] text-zinc-100 sm:text-[17px]">
        <div className="min-h-[1.65em]">
          <mark className={highlight.strong}>
            Neon bleeds through the rain-streaked glass
          </mark>
        </div>
        <div className="min-h-[1.65em]">
          <mark className={highlight.promising}>
            We run on borrowed time and cheaper thrills
          </mark>
        </div>
        <div className="min-h-[1.65em]">
          <mark className={highlight.strong}>The chorus hits like a closing door</mark>
        </div>
        <div className="min-h-[1.65em] pt-0.5">
          <mark className={highlight.suggestion}>
            I feel something when you turn away
          </mark>
        </div>

        <div
          className="mt-3 rounded-lg border border-violet-500/35 border-l-[3px] border-l-violet-400/50 bg-zinc-900 px-3.5 py-3 text-[13px] leading-snug text-zinc-100 sm:text-sm sm:leading-relaxed"
          role="note"
          aria-label="Example line feedback"
        >
          <span className="font-semibold text-violet-200">Suggestion</span>
          <span className="text-zinc-300">: </span>
          <span className="text-zinc-200">
            The feeling lands, but the image stays generic. Name one concrete detail:
            a gesture, object, or place, so listeners see the scene.
          </span>
        </div>
      </div>
    </div>
  );

  const label = (
    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      Line-by-line feedback
    </p>
  );

  if (embedded) {
    return (
      <div className="flex w-full min-w-0 max-w-none shrink-0 flex-col gap-2">
        {label}
        {draft}
      </div>
    );
  }

  return (
    <section className="w-full" aria-labelledby="landing-lyric-preview-heading">
      <h2
        id="landing-lyric-preview-heading"
        className="text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400 sm:text-left"
      >
        Line-by-line feedback
      </h2>
      <div className="mt-3">{draft}</div>
    </section>
  );
}
