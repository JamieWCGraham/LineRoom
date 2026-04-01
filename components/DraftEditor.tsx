"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function DraftEditor({ value, onChange }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Draft
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[min(50vh,420px)] flex-1 resize-y rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
        placeholder="Paste or write your full lyric draft…"
        spellCheck
      />
    </div>
  );
}
