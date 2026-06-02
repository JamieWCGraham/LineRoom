"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  removeDraftRecordingsForSong,
  removeExplicitRecordingPaths,
} from "@/lib/draft-recordings/removeSongRecordings";
import { requireAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  draftRecordingMetaSchema,
  saveSongVersionPayloadSchema,
} from "@/lib/validators";

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
  const userId = user.id;

  const { data: owned, error: ownedErr } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownedErr || !owned) {
    return { ok: false, message: "Piece not found." };
  }

  const { data: versionRows } = await supabase
    .from("song_versions")
    .select("meta")
    .eq("song_id", songId);

  const pathsFromMeta = new Set<string>();
  for (const row of versionRows ?? []) {
    const raw = row.meta;
    if (!raw || typeof raw !== "object") continue;
    const dr = (raw as { draftRecordings?: unknown }).draftRecordings;
    if (!Array.isArray(dr)) continue;
    for (const item of dr) {
      const p = draftRecordingMetaSchema.safeParse(item);
      if (p.success && p.data.objectPath.trim()) {
        pathsFromMeta.add(p.data.objectPath.trim());
      }
    }
  }

  const { data, error } = await supabase
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return { ok: false, message: "Piece not found." };
  }

  try {
    await removeExplicitRecordingPaths(pathsFromMeta);
    await removeDraftRecordingsForSong(userId, songId);
  } catch (e) {
    console.error("[draft-recordings] song delete cleanup threw:", e);
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
  | { ok: true; newSubRevision: number }
  | {
      ok: false;
      message: string;
      reason?: "stale" | "not_found" | "not_authenticated";
      currentSubRevision?: number;
    };

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
      brainstorm_text: parsed.data.brainstorm_text,
      chat_messages: parsed.data.chat_messages,
      critique: parsed.data.critique,
      meta: parsed.data.meta,
      save_sub_revision: 0,
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
  options: { expectedSubRevision: number },
): Promise<UpdateSongVersionResult> {
  const parsed = saveSongVersionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Invalid save payload." };
  }

  const supabase = await createClient();
  await requireAuthUser(supabase);

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "apply_song_version_state_update",
    {
      p_song_id: songId,
      p_version_id: versionId,
      p_expected_sub_revision: options.expectedSubRevision,
      p_draft_text: parsed.data.draft_text,
      p_brainstorm_text: parsed.data.brainstorm_text,
      p_chat_messages: parsed.data.chat_messages as unknown,
      p_critique: parsed.data.critique as unknown,
      p_meta: parsed.data.meta as unknown,
    },
  );

  if (rpcError) {
    return {
      ok: false,
      message: rpcError.message ?? "Could not update current version.",
    };
  }

  const row = rpcResult as unknown;
  if (!row || typeof row !== "object") {
    return { ok: false, message: "Unexpected save response." };
  }

  const obj = row as Record<string, unknown>;
  if (obj.ok === true && typeof obj.newSubRevision === "number") {
    return { ok: true, newSubRevision: obj.newSubRevision };
  }

  const reason = typeof obj.reason === "string" ? obj.reason : "";
  if (reason === "stale") {
    const currentSubRevision =
      typeof obj.currentSubRevision === "number" ?
        obj.currentSubRevision
      : undefined;
    return {
      ok: false,
      message:
        "This version was saved elsewhere. Save, then reload the page to continue safely.",
      reason: "stale",
      currentSubRevision,
    };
  }
  if (reason === "not_found") {
    return { ok: false, message: "Version not found.", reason: "not_found" };
  }
  if (reason === "not_authenticated") {
    return {
      ok: false,
      message: "You must be signed in to save.",
      reason: "not_authenticated",
    };
  }

  return { ok: false, message: "Could not update current version." };
}

/** Bust dashboard cache when navigating back from the editor (not on every autosave). */
export async function revalidateDashboardCache(): Promise<void> {
  revalidatePath("/");
}
