"use client";

import type { RewriteAction } from "@/lib/types";
import { REWRITE_ACTIONS } from "@/lib/types";

type Loading = "idle" | "rewrite" | "critique";

type Props = {
  selectedText: string;
  onSelectedChange: (value: string) => void;
  action: RewriteAction;
  onActionChange: (value: RewriteAction) => void;
  customInstruction: string;
  onCustomInstructionChange: (value: string) => void;
  voiceNotes: string;
  onVoiceNotesChange: (value: string) => void;
  onGenerate: () => void;
  onCritique: () => void;
  loading: Loading;
  disabledGenerate: boolean;
  disabledCritique: boolean;
};

export function ActionPanel({
  selectedText,
  onSelectedChange,
  action,
  onActionChange,
  customInstruction,
  onCustomInstructionChange,
  voiceNotes,
  onVoiceNotesChange,
  onGenerate,
  onCritique,
  loading,
  disabledGenerate,
  disabledCritique,
}: Props) {
  const busyRewrite = loading === "rewrite";
  const busyCritique = loading === "critique";

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-zinc-800 lg:border-x lg:px-4 lg:py-0">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Selected text
        </label>
        <p className="mb-2 text-[11px] leading-snug text-zinc-600">
          Paste the lines you want to edit, or match a substring of the draft
          exactly for replace / insert.
        </p>
        <textarea
          value={selectedText}
          onChange={(e) => onSelectedChange(e.target.value)}
          className="min-h-[140px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
          placeholder="Target excerpt…"
          spellCheck
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Edit action
        </label>
        <select
          value={action}
          onChange={(e) => onActionChange(e.target.value as RewriteAction)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
        >
          {REWRITE_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Custom instruction
          <span className="font-normal normal-case text-zinc-600">
            {" "}
            (optional)
          </span>
        </label>
        <textarea
          value={customInstruction}
          onChange={(e) => onCustomInstructionChange(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
          placeholder="Anything extra for this pass…"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Voice / style notes
          <span className="font-normal normal-case text-zinc-600">
            {" "}
            (optional)
          </span>
        </label>
        <textarea
          value={voiceNotes}
          onChange={(e) => onVoiceNotesChange(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
          placeholder="How you want it to sound…"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabledGenerate || busyRewrite || busyCritique}
          className="rounded-lg bg-amber-700/90 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyRewrite ? "Generating…" : "Generate rewrites"}
        </button>
        <button
          type="button"
          onClick={onCritique}
          disabled={disabledCritique || busyRewrite || busyCritique}
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyCritique ? "Critiquing…" : "Critique selection"}
        </button>
      </div>
    </div>
  );
}
