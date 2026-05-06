import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDraftRecordingsBucket } from "@/lib/draft-recordings/bucket";
import { buildDraftRecordingObjectPath } from "@/lib/draft-recordings/storagePath";
import { DRAFT_RECORDING_MAX_BYTES } from "@/lib/draft-recordings/uploadLimits";
import { draftRecordingMetaSchema } from "@/lib/validators";

const bodySchema = z.object({
  songId: z.string().uuid(),
  versionId: z.string().uuid(),
  recordingId: z.string().uuid(),
  name: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(120),
  durationSec: z.coerce.number().min(0).max(86_400).optional(),
  /** Optional; when set, must be within limit so clients cannot bypass UI checks silently. */
  sizeBytes: z.coerce.number().int().min(1).max(DRAFT_RECORDING_MAX_BYTES).optional(),
});

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "bin";
}

/**
 * Issues a Supabase signed upload URL so the browser uploads audio directly to
 * Storage (avoids Next.js body limits, timeouts, and buffering large blobs on the server).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields." }, { status: 400 });
  }

  const { songId, versionId, recordingId, name, mimeType, durationSec, sizeBytes } =
    parsed.data;

  if (typeof sizeBytes === "number" && sizeBytes > DRAFT_RECORDING_MAX_BYTES) {
    return NextResponse.json(
      { error: "Recording is too large (max 30 MB)." },
      { status: 413 },
    );
  }

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

  const ext = extForMime(mimeType);
  const objectPath = buildDraftRecordingObjectPath(
    user.id,
    songId,
    versionId,
    recordingId,
    ext,
  );
  const bucket = getDraftRecordingsBucket();
  const service = createServiceRoleClient();

  const { data: signData, error: signErr } = await service.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (signErr || !signData?.token || !signData?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "Could not create upload URL." },
      { status: 502 },
    );
  }

  const createdAt = new Date().toISOString();
  const recording = {
    id: recordingId,
    name: name.trim(),
    objectPath,
    mimeType,
    createdAt,
    ...(typeof durationSec === "number" ? { durationSec } : {}),
  };
  const metaOk = draftRecordingMetaSchema.safeParse(recording);
  if (!metaOk.success) {
    return NextResponse.json({ error: "Invalid recording metadata." }, { status: 500 });
  }

  return NextResponse.json({
    bucket,
    path: signData.path,
    token: signData.token,
    signedUrl: signData.signedUrl,
    maxBytes: DRAFT_RECORDING_MAX_BYTES,
    recording: metaOk.data,
  });
}
