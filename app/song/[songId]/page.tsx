import { notFound } from "next/navigation";
import { LineRoomEditor } from "@/components/LineRoomEditor";
import { requireAuthUser } from "@/lib/auth/guards";
import { versionStateFromRow } from "@/lib/songs/versionState";
import { createClient } from "@/lib/supabase/server";
import type { SongRow, SongVersionRow } from "@/types/database";

type Props = {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ v?: string }>;
};

export default async function SongPage({ params, searchParams }: Props) {
  const { songId } = await params;
  const q = await searchParams;

  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  const [{ data: song, error: songError }, { data: versionRows, error: versionsError }] =
    await Promise.all([
      supabase
        .from("songs")
        .select("*")
        .eq("id", songId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("song_versions")
        // Use * so the page works before `brainstorm_text` exists; listing columns
        // would 400 and trigger notFound() until the migration is applied.
        .select("*")
        .eq("song_id", songId)
        .order("version_number", { ascending: true }),
    ]);

  if (songError || !song) notFound();

  if (versionsError || !versionRows?.length) notFound();

  const typedSong = song as SongRow;
  const songRow = typedSong as SongRow & {
    share_token?: string | null;
    published_at?: string | null;
    published_from_version_id?: string | null;
    published_draft_text?: string | null;
  };
  const versions = versionRows as SongVersionRow[];

  let activeRow = versions[versions.length - 1]!;
  if (q.v) {
    const found = versions.find((r) => r.id === q.v);
    if (found) activeRow = found;
  }

  const vs = versionStateFromRow(activeRow);
  const initialSaveSubRevision = Number(
    (activeRow as { save_sub_revision?: unknown }).save_sub_revision ?? 0,
  );
  const priorVersionsContext = versions
    .filter((r) => Number(r.version_number) < Number(activeRow.version_number))
    .sort((a, b) => Number(b.version_number) - Number(a.version_number))
    .slice(0, 5)
    .map((r) => {
      const prior = versionStateFromRow(r);
      return {
        versionNumber: Number(r.version_number),
        draftText: prior.draftText,
        critique: prior.critique,
      };
    });
  const versionSummaries = versions.map((r) => ({
    id: r.id,
    versionNumber: Number(r.version_number),
    createdAt: r.created_at,
  }));

  return (
    <LineRoomEditor
      key={`${typedSong.id}:${activeRow.id}`}
      mode="song"
      songId={typedSong.id}
      songTitle={typedSong.title}
      versions={versionSummaries}
      priorVersionsContext={priorVersionsContext}
      activeVersionNumber={Number(activeRow.version_number)}
      activeVersionId={activeRow.id}
      initialDraftText={vs.draftText}
      initialBrainstormText={vs.brainstormText}
      initialChatMessages={vs.chatMessages}
      initialCritique={vs.critique}
      initialMeta={vs.meta}
      initialSaveSubRevision={initialSaveSubRevision}
      initialShareToken={songRow.share_token ?? null}
      initialPublishedAt={songRow.published_at ?? null}
      initialPublishedFromVersionId={songRow.published_from_version_id ?? null}
      initialPublishedDraftText={songRow.published_draft_text ?? null}
    />
  );
}
