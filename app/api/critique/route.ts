import { NextResponse } from "next/server";
import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { getFreeCritiqueQuota } from "@/lib/billing/config";
import type { CritiqueAccessState } from "@/lib/billing/types";
import { getAuthUser } from "@/lib/auth/guards";
import { createBaseOpenAI, getChatModel } from "@/lib/openai";
import {
  buildCritiqueUserPayload,
  CRITIQUE_JSON_INSTRUCTIONS,
} from "@/lib/prompts";
import type { CritiqueResult } from "@/lib/types";
import { critiqueRequestSchema, critiqueResultSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase/server";

function attachSongVersionContext(
  critique: CritiqueResult,
  payload: {
    analyzedSongVersion?: number;
    priorSongVersionCompared?: number | null;
    regenerate?: boolean;
  },
): CritiqueResult {
  const out = { ...critique };
  if (typeof payload.analyzedSongVersion === "number") {
    out.analyzedSongVersion = payload.analyzedSongVersion;
  } else {
    delete out.analyzedSongVersion;
    delete out.priorSongVersionCompared;
    delete out.comparedToSummary;
    return out;
  }

  if (payload.priorSongVersionCompared !== undefined) {
    out.priorSongVersionCompared = payload.priorSongVersionCompared;
  }

  if (payload.priorSongVersionCompared != null) {
    out.comparedToSummary = `Full saved lyrics draft and critique from version ${payload.priorSongVersionCompared} were included for comparison.`;
  } else if (payload.regenerate) {
    out.comparedToSummary = `Compared to the previous critique and the saved lyrics draft for version ${payload.analyzedSongVersion} from when this page was loaded (before your latest edits).`;
  } else {
    delete out.comparedToSummary;
  }

  return out;
}

function paywallResponse(access: CritiqueAccessState) {
  return NextResponse.json(
    {
      code: "PAYWALL_REQUIRED" as const,
      remainingFreeCritiques: access.remainingFreeCritiques,
      checkoutRequired: true,
      message: "Subscribe to LineRoom Pro to keep generating critiques.",
      access,
    },
    { status: 402 },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessBefore = await getCritiqueAccessForUser(supabase, user);
  if (!accessBefore.canGenerateCritique) {
    return paywallResponse(accessBefore);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = critiqueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const freeQuota = getFreeCritiqueQuota();
  const needsSlot =
    !accessBefore.isBypassed && !accessBefore.hasActiveSubscription;

  let slotReserved = false;
  let success = false;

  try {
    if (needsSlot) {
      const { data: reserved, error: reserveError } = await supabase.rpc(
        "reserve_free_critique_slot",
        { p_quota: freeQuota },
      );
      if (reserveError) {
        console.error("[critique] reserve slot", reserveError.message);
        return NextResponse.json(
          { error: "Could not verify critique quota." },
          { status: 500 },
        );
      }
      if (!reserved) {
        const accessNow = await getCritiqueAccessForUser(supabase, user);
        return paywallResponse(accessNow);
      }
      slotReserved = true;
    }

    scheduleLangfuseFlush();

    const payload = parsed.data;
    const userContent = buildCritiqueUserPayload(payload);

    let critique: CritiqueResult;
    try {
      critique = await runWithLangfuseTrace(
        {
          traceName: "LineRoom",
          rootObservationName: "lineroom-critique",
          tags: ["lineroom", "critique"],
          langfuseConfig: {
            traceName: "LineRoom",
            generationName: "lyric-critique",
            tags: ["lineroom", "critique"],
          },
        },
        async ({ createTracedOpenAI, setTraceIO }) => {
          const openai = createTracedOpenAI(createBaseOpenAI());
          const completion = await openai.chat.completions.create({
            model: getChatModel(),
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: CRITIQUE_JSON_INSTRUCTIONS },
              { role: "user", content: userContent },
            ],
          });

          const raw = completion.choices[0]?.message?.content?.trim();
          if (!raw) {
            throw new Error("__EMPTY_MODEL__");
          }

          let json: unknown;
          try {
            json = JSON.parse(raw) as unknown;
          } catch {
            throw new Error("__BAD_JSON__");
          }

          const validated = critiqueResultSchema.safeParse(json);
          if (!validated.success) {
            throw new Error("__BAD_SHAPE__");
          }

          const c = attachSongVersionContext(validated.data, payload);

          setTraceIO({
            input: { messages: payload },
            output: c,
          });
          return c;
        },
      );
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
      console.error("[critique]", message);
      return NextResponse.json({ error: "Critique failed" }, { status: 500 });
    }

    success = true;
    const accessAfter = await getCritiqueAccessForUser(supabase, user);
    return NextResponse.json({ critique, access: accessAfter });
  } finally {
    if (slotReserved && !success) {
      const { error } = await supabase.rpc("release_free_critique_slot");
      if (error) {
        console.error("[critique] release slot", error.message);
      }
    }
  }
}
