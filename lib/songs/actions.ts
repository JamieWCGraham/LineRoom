"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { saveSongVersionPayloadSchema } from "@/lib/validators";

const SONG_TITLE_MAX = 200;

export type UpdateSongTitleResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateSongTitle(
  songId: string,
  titleRaw: string,
): Promise<UpdateSongTitleResult> {
  const trimmed = titleRaw.trim();
  const title =
    trimmed.length ?
      trimmed.slice(0, SONG_TITLE_MAX)
    : "Untitled piece";

  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (songError || !song) {
    return { ok: false, message: "Piece not found." };
  }

  const { error: updateError } = await supabase
    .from("songs")
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", songId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true };
}

export type DeleteSongResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteSong(songId: string): Promise<DeleteSongResult> {
  if (!songId.trim()) {
    return { ok: false, message: "Missing piece id." };
  }

  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  const { data, error } = await supabase
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return { ok: false, message: "Piece not found." };
  }

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true };
}

export async function createSong(): Promise<void> {
  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  const { data: song, error: songError } = await supabase
    .from("songs")
    .insert({ user_id: user.id, title: "Untitled piece" })
    .select("id")
    .single();

  if (songError || !song) {
    redirect("/?createError=1");
  }

  const emptyMeta = { title: "", similarArtists: "", genre: "" };
  const { error: versionError } = await supabase.from("song_versions").insert({
    song_id: song.id,
    version_number: 1,
    draft_text: "",
    chat_messages: [],
    critique: null,
    meta: emptyMeta,
  });

  if (versionError) {
    await supabase.from("songs").delete().eq("id", song.id);
    redirect("/?createError=1");
  }

  redirect(`/song/${song.id}`);
}

export type SaveSongVersionResult =
  | { ok: true; versionId: string }
  | { ok: false; message: string };

export async function saveNewSongVersion(
  songId: string,
  payload: unknown,
): Promise<SaveSongVersionResult> {
  const parsed = saveSongVersionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Invalid save payload." };
  }

  const supabase = await createClient();
  const user = await requireAuthUser(supabase);

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (songError || !song) {
    return { ok: false, message: "Piece not found." };
  }

  const { data: maxRow } = await supabase
    .from("song_versions")
    .select("version_number")
    .eq("song_id", songId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (maxRow?.version_number ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("song_versions")
    .insert({
      song_id: songId,
      version_number: nextNumber,
      draft_text: parsed.data.draft_text,
      chat_messages: parsed.data.chat_messages,
      critique: parsed.data.critique,
      meta: parsed.data.meta,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      message: insertError?.message ?? "Could not save version.",
    };
  }

  await supabase
    .from("songs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", songId);

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true, versionId: inserted.id };
}
