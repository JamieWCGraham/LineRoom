"use client";

import type { CritiqueResponse } from "@/lib/types";

type Props = {
  result: CritiqueResponse | null;
};

function List({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "strength" | "weak";
}) {
  if (!items.length) return null;
  const dot =
    variant === "strength"
      ? "text-emerald-500/90"
      : "text-rose-400/80";
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-zinc-300">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={dot}>•</span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CritiquePanel({ result }: Props) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-6 text-center text-sm text-zinc-600">
        Run <span className="text-zinc-400">Critique selection</span> to see
        editorial notes here.
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <List title="What's working" items={result.strengths} variant="strength" />
      <List title="What's weak" items={result.weaknesses} variant="weak" />

      {(result.strongestLine || result.weakestLine) && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {result.strongestLine ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Strongest line
              </h3>
              <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2 text-zinc-200">
                {result.strongestLine}
              </p>
            </div>
          ) : null}
          {result.weakestLine ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Weakest line
              </h3>
              <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2 text-zinc-200">
                {result.weakestLine}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 text-sm">
        {result.clicheRisk ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cliché risk
            </h3>
            <p className="leading-relaxed text-zinc-300">{result.clicheRisk}</p>
          </div>
        ) : null}
        {result.emotionalClarity ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Emotional clarity
            </h3>
            <p className="leading-relaxed text-zinc-300">
              {result.emotionalClarity}
            </p>
          </div>
        ) : null}
        {result.nextMove ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600/80">
              Next move
            </h3>
            <p className="leading-relaxed text-zinc-200">{result.nextMove}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
