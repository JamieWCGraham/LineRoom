import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDraftRecordingsBucket } from "@/lib/draft-recordings/bucket";
import { assertRecordingObjectAccess } from "@/lib/draft-recordings/verifyPath";

const bodySchema = z.object({
  objectPath: z.string().min(1).max(512),
});

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
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const access = await assertRecordingObjectAccess(
    supabase,
    user,
    parsed.data.objectPath,
  );
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    );
  }

  const bucket = getDraftRecordingsBucket();
  const service = createServiceRoleClient();
  const { error } = await service.storage
    .from(bucket)
    .remove([parsed.data.objectPath]);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Delete failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
