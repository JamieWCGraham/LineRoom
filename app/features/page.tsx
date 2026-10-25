import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Features — LineRoom",
  description:
    "Line-by-line lyric critique, influence and genre context, workshop chat, a lyrics editor with draft and brainstorm modes, and a free trial.",
  path: "/features",
});

const sections = [
  {
    title: "Line-by-line critique",
    body: "Highlighted feedback on every line: what's working, what to strengthen, with concrete suggestions.",
  },
  {
    title: "Influence + genre context",
    body: "Tell LineRoom your closest artists and genre so feedback fits the song you're actually writing.",
  },
  {
    title: "Workshop tools",
    body: "Once you create an account, use Rhyme, Suggestion, and Thesaurus — one word or one line at a time.",
  },
  {
    title: "Editor built for lyrics",
    body: "DRAFT / BRAINSTORM modes, voice-memo recording, and formatting controls for bold, underline, and type size.",
  },
  {
    title: "Free to try",
    body: "3 critiques, no account needed.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <MarketingHeader />
      <header className="mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Features
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-300">
          A lyrics workspace for drafting, recording ideas, and getting line-by-line feedback.
        </p>
      </header>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-100">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{section.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/lineroom"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
        >
          Try free
        </Link>
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          See pricing
        </Link>
      </div>
    </main>
  );
}
