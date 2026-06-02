import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBrandLogo } from "@/components/app-brand";
import { PublishedLyricDocument } from "@/components/lyrics/PublishedLyricDocument";
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
    <main className="published-lyrics-page">
      <PublishedLyricDocument
        title={published.title}
        draftText={published.draftText}
      />

      <footer className="published-lyrics-document published-lyrics-footer">
        <Link href="/" className="published-lyrics-footer-link">
          <AppBrandLogo size={24} className="h-6 w-6" />
          Shared with LineRoom
        </Link>
      </footer>
    </main>
  );
}
