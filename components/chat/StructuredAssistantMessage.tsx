"use client";

import { useState } from "react";
import type { ChatActionResponse } from "@/types/chat";

type Props = {
  structured: ChatActionResponse;
};

export function StructuredAssistantMessage({ structured }: Props) {
  const [copied, setCopied] = useState<number | null>(null);

  const copyOption = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const opts = structured.options ?? [];
  const isFindRhymes = structured.mode === "find_rhymes";

  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
      <p className="font-medium text-zinc-100">{structured.summary}</p>

      {structured.diagnosis && structured.diagnosis.length > 0 ?
        <ul className="list-disc space-y-1 pl-4 text-zinc-300">
          {structured.diagnosis.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      : null}

      {opts.length > 0 && isFindRhymes ?
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="Rhyme suggestions"
        >
          {opts.map((opt, i) => {
            const label = opt.trim() || `Option ${i + 1}`;
            return (
              <button
                key={i}
                type="button"
                title={`Copy “${label}”`}
                aria-label={`Copy rhyme: ${label}`}
                onClick={() => void copyOption(opt, i)}
                className="min-h-[2.75rem] rounded-lg border border-zinc-700/80 bg-zinc-900/55 px-2 py-2 text-center text-sm font-medium text-zinc-100 transition hover:border-amber-800/45 hover:bg-amber-950/25 hover:text-amber-50 active:bg-zinc-800/80"
              >
                <span className="line-clamp-2 break-words">{label}</span>
                <span className="mt-1 block text-[10px] font-normal text-zinc-500">
                  {copied === i ? "Copied" : "Tap to copy"}
                </span>
              </button>
            );
          })}
        </div>
      : null}

      {opts.length > 0 && !isFindRhymes ?
        <ol className="list-decimal space-y-3 pl-4 marker:text-zinc-500">
          {opts.map((opt, i) => {
            const rec =
              structured.recommendedOption != null &&
              structured.recommendedOption === i;
            return (
              <li
                key={i}
                className={
                  rec ?
                    "rounded-md border border-emerald-800/50 bg-emerald-950/20 pl-1"
                  : ""
                }
              >
                <div className="whitespace-pre-wrap pl-1 text-zinc-200">{opt}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                  >
                    Insert below
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyOption(opt, i)}
                    className="rounded border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                  >
                    {copied === i ? "Copied" : "Copy"}
                  </button>
                  {rec ?
                    <span className="self-center text-[10px] font-medium text-emerald-400/90">
                      Suggested
                    </span>
                  : null}
                </div>
              </li>
            );
          })}
        </ol>
      : null}
    </div>
  );
}
