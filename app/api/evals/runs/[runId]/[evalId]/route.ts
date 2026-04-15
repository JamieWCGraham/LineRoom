import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evalOutputObjectPath,
  getLineRoomEvalsBucket,
} from "@/lib/evals/bucket";
import { fetchEvalSetRowById } from "@/lib/evals/evalSetRow";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { runCritiqueModel } from "@/lib/critique/runCritiqueModel";

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

/**
 * Re-runs critique generation for one eval row and overwrites
 * `{runId}/{evalId}/output.json` in storage.
 */
export async function POST(_req: Request, { params }: Params) {
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

  const loaded = await fetchEvalSetRowById(admin, idNum);
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error, detail: loaded.detail },
      { status: 400 },
    );
  }

  const { row, requestPayload } = loaded;
  const started = Date.now();
  let payload: Record<string, unknown>;
  try {
    const { critique, userContent } = await runCritiqueModel(requestPayload, {
      traceTags: ["lineroom", "critique", "critique-eval-retry"],
      rootObservationName: "lineroom-critique-eval-retry",
      generationName: "lyric-critique-eval-retry",
    });
    payload = {
      runTimestamp: runId,
      source: "eval_set",
      evalSetId: idNum,
      evalRow: row,
      requestPayload,
      userPrompt: userContent,
      critique,
      elapsedMs: Date.now() - started,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    payload = {
      runTimestamp: runId,
      source: "eval_set",
      evalSetId: idNum,
      evalRow: row,
      requestPayload,
      elapsedMs: Date.now() - started,
      error: message,
    };
  }

  const bucket = getLineRoomEvalsBucket();
  const path = evalOutputObjectPath(runId, idNum);
  const { error } = await admin
    .storage
    .from(bucket)
    .upload(path, JSON.stringify(payload, null, 2), {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    });

  if (error) {
    return NextResponse.json(
      { error: "Failed to write retried output", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    runId,
    evalId: idNum,
    message: `Retried eval row ${idNum} for run ${runId}.`,
  });
}
