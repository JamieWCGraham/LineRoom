import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evalOutputObjectPath,
  getLineRoomEvalsBucket,
} from "@/lib/evals/bucket";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";

type Params = { params: Promise<{ runId: string; evalId: string }> };

/**
 * Returns stored JSON for one eval result.
 */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const { runId, evalId } = await params;
  if (!runId || runId.includes("..") || runId.includes("/")) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }
  const idNum = Number.parseInt(evalId, 10);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.json({ error: "Invalid evalId" }, { status: 400 });
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
  const path = evalOutputObjectPath(runId, idNum);
  const { data, error } = await admin.storage.from(bucket).download(path);

  if (error) {
    const notFound =
      error.message?.toLowerCase().includes("not found") ||
      error.message?.toLowerCase().includes("404");
    return NextResponse.json(
      { error: notFound ? "Not found" : error.message },
      { status: notFound ? 404 : 500 },
    );
  }

  const text = await data.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Stored file is not valid JSON" },
      { status: 500 },
    );
  }

  return NextResponse.json(json);
}
