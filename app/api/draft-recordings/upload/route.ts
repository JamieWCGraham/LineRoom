import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDraftRecordingsBucket } from "@/lib/draft-recordings/bucket";
import { buildDraftRecordingObjectPath } from "@/lib/draft-recordings/storagePath";
import { draftRecordingMetaSchema } from "@/lib/validators";

const MAX_BYTES = 30 * 1024 * 1024;

const formSchema = z.object({
  songId: z.string().uuid(),
  versionId: z.string().uuid(),
  recordingId: z.string().uuid(),
  name: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(120),
  durationSec: z.coerce.number().min(0).max(86_400).optional(),
});

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "bin";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const parsed = formSchema.safeParse({
    songId: form.get("songId"),
    versionId: form.get("versionId"),
    recordingId: form.get("recordingId"),
    name: form.get("name"),
    mimeType: form.get("mimeType"),
    durationSec: form.get("durationSec") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Recording is too large (max 30 MB)." },
      { status: 413 },
    );
  }

  const { songId, versionId, recordingId, name, mimeType, durationSec } =
    parsed.data;

  const { data: version, error: vErr } = await supabase
    .from("song_versions")
    .select("id, song_id")
    .eq("id", versionId)
    .eq("song_id", songId)
    .maybeSingle();

  if (vErr || !version) {
    return NextResponse.json({ error: "Version not found." }, { status: 404 });
  }

  const { data: song, error: sErr } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sErr || !song) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ext = extForMime(mimeType || file.type || "audio/webm");
  const objectPath = buildDraftRecordingObjectPath(
    user.id,
    songId,
    versionId,
    recordingId,
    ext,
  );
  const bucket = getDraftRecordingsBucket();
  const service = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await service.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType: mimeType || file.type || "audio/webm",
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json(
      { error: upErr.message || "Upload failed." },
      { status: 502 },
    );
  }

  const createdAt = new Date().toISOString();
  const recording = {
    id: recordingId,
    name: name.trim(),
    objectPath,
    mimeType: mimeType || file.type || "audio/webm",
    createdAt,
    ...(typeof durationSec === "number" ? { durationSec } : {}),
  };
  const metaOk = draftRecordingMetaSchema.safeParse(recording);
  if (!metaOk.success) {
    await service.storage.from(bucket).remove([objectPath]);
    return NextResponse.json({ error: "Invalid recording metadata." }, { status: 500 });
  }

  return NextResponse.json({ recording: metaOk.data });
}
