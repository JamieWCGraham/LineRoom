import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBrandLogo } from "@/components/app-brand";
import { fetchPublishedLyrics } from "@/lib/songs/publishedLyrics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const published = await fetchPublishedLyrics(supabase, token);

  if (!published) {
    return {
      title: "Not found · LineRoom",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${published.title} · LineRoom`,
    robots: { index: false, follow: false },
  };
}

export default async function PublishedLyricsPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const published = await fetchPublishedLyrics(supabase, token);

  if (!published) notFound();

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {published.title}
          </h1>
        </header>

        <article className="flex-1">
          {published.draftText.trim() ?
            <pre className="whitespace-pre-wrap font-mono text-base leading-relaxed text-zinc-200 sm:text-[17px]">
              {published.draftText}
            </pre>
          : <p className="text-sm text-zinc-500">No lyrics yet.</p>
          }
        </article>

        <footer className="mt-12 border-t border-zinc-800/80 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            <AppBrandLogo size={24} className="h-6 w-6" />
            Shared with LineRoom
          </Link>
        </footer>
      </div>
    </main>
  );
}
