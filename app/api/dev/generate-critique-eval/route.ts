import { NextResponse } from "next/server";
import { z } from "zod";
import { runCritiqueModel } from "@/lib/critique/runCritiqueModel";
import {
  fetchEvalSetRowById,
  type ParsedEvalSetRow,
} from "@/lib/evals/evalSetRow";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { critiqueRequestSchema } from "@/lib/validators";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getEvalSecret(): string | null {
  const s = process.env.LINEROOM_CRITIQUE_EVAL_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

function checkBearer(req: Request, secret: string): boolean {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return false;
  const token = h.slice("Bearer ".length).trim();
  return token.length > 0 && token === secret;
}

/**
 * Headless critique generation for evaluation / scripts.
 *
 * Auth: `Authorization: Bearer <LINEROOM_CRITIQUE_EVAL_SECRET>` (required).
 *
 * Body (one of):
 * - `{ "evalSetId": <number> }` or `{ "id": <number> }` (no `fullText`) — loads
 *   `generate_critique_eval_set` by primary key `id`.
 * - A full critique request (same shape as POST /api/critique): `fullText`, `title`,
 *   `similarArtists`, `genre`, plus optional `priorVersions`, `regenerate`, etc.
 *
 * Response includes `requestPayload`, `userPrompt` (exact user message to the model), and `critique`.
 */
export async function POST(req: Request) {
  const secret = getEvalSecret();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "LINEROOM_CRITIQUE_EVAL_SECRET is not set; refusing eval endpoint.",
      },
      { status: 503 },
    );
  }
  if (!checkBearer(req, secret)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj =
    typeof body === "object" && body !== null ?
      (body as Record<string, unknown>)
    : null;

  let resolvedEvalId: number | null = null;
  if (obj) {
    const ev = obj.evalSetId;
    const rowId = obj.id;
    if (typeof ev === "number" && Number.isInteger(ev) && ev > 0) {
      resolvedEvalId = ev;
    } else if (
      typeof rowId === "number" &&
      Number.isInteger(rowId) &&
      rowId > 0 &&
      typeof obj.fullText !== "string"
    ) {
      resolvedEvalId = rowId;
    }
  }

  let source: "eval_set" | "json";
  let evalRow: ParsedEvalSetRow | null = null;
  let requestPayload: z.infer<typeof critiqueRequestSchema>;

  if (resolvedEvalId != null) {
    source = "eval_set";
    let admin;
    try {
      admin = createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "config";
      return NextResponse.json(
        { error: "Supabase service role not configured", detail: msg },
        { status: 503 },
      );
    }

    const loaded = await fetchEvalSetRowById(admin, resolvedEvalId);
    if (!loaded.ok) {
      if (loaded.error === "No row for id") {
        return NextResponse.json(
          { error: "No row for id", id: resolvedEvalId },
          { status: 404 },
        );
      }
      if (loaded.error === "Eval row has empty lyrics") {
        return NextResponse.json(
          { error: loaded.error, evalSetId: resolvedEvalId },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: loaded.error,
          ...(loaded.detail ? { detail: loaded.detail } : {}),
        },
        { status: 500 },
      );
    }
    evalRow = loaded.row;
    requestPayload = loaded.requestPayload;
  } else {
    source = "json";
    const parsed = critiqueRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
          hint: 'Send a critique body or { "evalSetId": number } / { "id": number }',
        },
        { status: 400 },
      );
    }
    requestPayload = parsed.data;
  }

  const started = Date.now();
  try {
    const { critique, userContent } = await runCritiqueModel(requestPayload, {
      traceTags: ["lineroom", "critique", "critique-eval"],
      rootObservationName: "lineroom-critique-eval",
      generationName: "lyric-critique-eval",
    });
    return NextResponse.json({
      source,
      evalRow,
      requestPayload,
      userPrompt: userContent,
      critique,
      elapsedMs: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "OPENAI_API_KEY is not set") {
      return NextResponse.json(
        { error: "Server is not configured with OPENAI_API_KEY" },
        { status: 503 },
      );
    }
    if (message === "__EMPTY_MODEL__") {
      return NextResponse.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }
    if (message === "__BAD_JSON__") {
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502 },
      );
    }
    if (message === "__BAD_SHAPE__") {
      return NextResponse.json(
        { error: "Critique shape validation failed" },
        { status: 502 },
      );
    }
    if (message === "__BAD_REQUEST__") {
      return NextResponse.json(
        { error: "Request rejected by model API (malformed body)" },
        { status: 502 },
      );
    }
    console.error("[generate-critique-eval]", message);
    return NextResponse.json({ error: "Critique failed" }, { status: 500 });
  }
}
