import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getLineRoomEvalsBucket } from "@/lib/evals/bucket";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";

type Params = { params: Promise<{ runId: string }> };

/**
 * Lists eval set ids under a run folder (subfolders that contain output.json).
 */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const { runId } = await params;
  if (!runId || runId.includes("..") || runId.includes("/")) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 503 },
    );
  }

  const bucket = getLineRoomEvalsBucket();
  const { data, error } = await admin.storage.from(bucket).list(runId, {
    limit: 2000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to list run", detail: error.message },
      { status: 500 },
    );
  }

  const ids: number[] = [];
  for (const entry of data ?? []) {
    const n = Number.parseInt(entry.name, 10);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  ids.sort((a, b) => a - b);

  return NextResponse.json({ runId, ids });
}
