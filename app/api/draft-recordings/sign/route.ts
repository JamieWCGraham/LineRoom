import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDraftRecordingsBucket } from "@/lib/draft-recordings/bucket";
import { assertRecordingObjectAccess } from "@/lib/draft-recordings/verifyPath";

const SIGNED_TTL_SEC = 3600;

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const objectPath = new URL(req.url).searchParams.get("path")?.trim() ?? "";
  if (!objectPath) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  const access = await assertRecordingObjectAccess(supabase, user, objectPath);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    );
  }

  const bucket = getDraftRecordingsBucket();
  const service = createServiceRoleClient();
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_TTL_SEC);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign URL." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn: SIGNED_TTL_SEC,
  });
}
