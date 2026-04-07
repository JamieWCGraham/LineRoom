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
  await requireAuthUser(supabase);

  const { data: songId, error } = await supabase.rpc(
    "create_song_with_initial_version",
  );

  if (error || !songId) {
    redirect("/?createError=1");
  }
  redirect(`/song/${songId}`);
}

export type CreateSongResult =
  | { ok: true; songId: string }
  | { ok: false; message: string };

export async function createSongAndInitialVersion(): Promise<CreateSongResult> {
  const supabase = await createClient();
  await requireAuthUser(supabase);

  const { data: songId, error } = await supabase.rpc(
    "create_song_with_initial_version",
  );

  if (error || !songId) {
    return { ok: false, message: "Could not create a new piece." };
  }

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true, songId };
}

export type SaveSongVersionResult =
  | { ok: true; versionId: string }
  | { ok: false; message: string };

export type UpdateSongVersionResult =
  | { ok: true }
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

export type DeleteSongVersionResult =
  | { ok: true; fallbackVersionId: string }
  | { ok: false; message: string };

export async function deleteSongVersion(
  songId: string,
  versionId: string,
): Promise<DeleteSongVersionResult> {
  if (!songId.trim() || !versionId.trim()) {
    return { ok: false, message: "Missing piece or version id." };
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

  const { data: versionRows, error: listError } = await supabase
    .from("song_versions")
    .select("id, version_number")
    .eq("song_id", songId)
    .order("version_number", { ascending: true });

  if (listError || !versionRows?.length) {
    return { ok: false, message: "Could not load versions." };
  }

  if (versionRows.length <= 1) {
    return {
      ok: false,
      message:
        "You cannot delete the only version. Delete the whole piece from the dashboard instead.",
    };
  }

  const exists = versionRows.some((r) => r.id === versionId);
  if (!exists) {
    return { ok: false, message: "Version not found." };
  }

  const { error: delError } = await supabase
    .from("song_versions")
    .delete()
    .eq("id", versionId)
    .eq("song_id", songId);

  if (delError) {
    return { ok: false, message: delError.message };
  }

  const remaining = versionRows.filter((r) => r.id !== versionId);
  const fallback = remaining.reduce((best, r) =>
    Number(r.version_number) > Number(best.version_number) ? r : best,
  );

  await supabase
    .from("songs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", songId);

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true, fallbackVersionId: fallback.id };
}

export async function updateSongVersionState(
  songId: string,
  versionId: string,
  payload: unknown,
): Promise<UpdateSongVersionResult> {
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

  const { data: updatedRow, error: updateError } = await supabase
    .from("song_versions")
    .update({
      draft_text: parsed.data.draft_text,
      chat_messages: parsed.data.chat_messages,
      critique: parsed.data.critique,
      meta: parsed.data.meta,
    })
    .eq("id", versionId)
    .eq("song_id", songId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRow) {
    return {
      ok: false,
      message: updateError?.message ?? "Could not update current version.",
    };
  }

  await supabase
    .from("songs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", songId);

  revalidatePath("/");
  revalidatePath(`/song/${songId}`);

  return { ok: true };
}
