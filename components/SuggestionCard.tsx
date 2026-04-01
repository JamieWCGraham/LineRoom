"use client";

import type { RewriteOption } from "@/lib/types";

type Props = {
  option: RewriteOption;
  index: number;
  onReplace: (text: string) => void;
  onInsertBelow: (text: string) => void;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  busy: boolean;
};

export function SuggestionCard({
  option,
  index,
  onReplace,
  onInsertBelow,
  onCopy,
  onRegenerate,
  busy,
}: Props) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-200/90">
          {option.label}
        </h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
          #{index + 1}
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {option.rationale}
      </p>
      <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 font-sans text-[13px] leading-relaxed text-zinc-200">
        {option.text}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onReplace(option.text)}
          disabled={busy}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
        >
          Replace selection
        </button>
        <button
          type="button"
          onClick={() => onInsertBelow(option.text)}
          disabled={busy}
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Insert below
        </button>
        <button
          type="button"
          onClick={() => onCopy(option.text)}
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="ml-auto rounded-md text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-40"
        >
          Regenerate all
        </button>
      </div>
    </article>
  );
}
