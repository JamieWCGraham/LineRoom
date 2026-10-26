import { NextResponse } from "next/server";
import {
  getCritiqueAccessForUser,
  getCritiqueQuotaForUser,
} from "@/lib/billing/access";
import type { CritiqueAccessState } from "@/lib/billing/types";
import { getAuthUser } from "@/lib/auth/guards";
import {
  isDraftCritiqueGateEnabled,
} from "@/lib/critique/draftCritiqueGateConfig";
import {
  lookupDraftCritiqueRegistry,
  registerDraftCritiqueRegistry,
  toGateContext,
} from "@/lib/critique/draftCritiqueGate";
import { runCritiqueModel } from "@/lib/critique/runCritiqueModel";
import { buildLangfuseTraceUser } from "@/lib/langfuse/traceUser";
import { posthogLog, schedulePostHogLogFlush } from "@/lib/posthog-logs";
import type { CritiqueResult } from "@/lib/types";
import { critiqueRequestSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase/server";

function paywallResponse(access: CritiqueAccessState) {
  const message =
    access.isAnonymous ?
      "Sign up to keep generating critiques and save your work."
    : "Subscribe to LineRoom Pro to keep generating critiques.";
  return NextResponse.json(
    {
      code: "PAYWALL_REQUIRED" as const,
      remainingFreeCritiques: access.remainingFreeCritiques,
      checkoutRequired: !access.isAnonymous,
      message,
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

  if (
    !process.env.AI_GATEWAY_API_KEY?.trim() &&
    !process.env.VERCEL_AI_GATEWAY_API_KEY?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Server is not configured with AI_GATEWAY_API_KEY (critique uses Vercel AI Gateway)",
      },
      { status: 503 },
    );
  }

  const freeQuota = getCritiqueQuotaForUser(user);
  const needsSlot =
    !accessBefore.isBypassed && !accessBefore.hasActiveSubscription;

  let slotReserved = false;
  let success = false;

  const payload = parsed.data;
  const gateEnabled = isDraftCritiqueGateEnabled();

  try {
    const gateLookupPromise = gateEnabled ?
      lookupDraftCritiqueRegistry(supabase, payload.fullText)
    : Promise.resolve({ kind: "miss" as const });

    const reservePromise =
      needsSlot ?
        supabase.rpc("reserve_free_critique_slot", { p_quota: freeQuota })
      : Promise.resolve({ data: true, error: null });

    const profilePromise = supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const [gateLookup, reserveResult, profileResult] = await Promise.all([
      gateLookupPromise,
      reservePromise,
      profilePromise,
    ]);

    if (needsSlot) {
      const { data: reserved, error: reserveError } = reserveResult;
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

    const gateContext = toGateContext(gateLookup, gateEnabled);
    const traceUser = buildLangfuseTraceUser(user, profileResult.data);

    let critique: CritiqueResult;
    try {
      ({ critique } = await runCritiqueModel(payload, {
        gate: gateContext,
        traceUser,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      if (message === "AI_GATEWAY_API_KEY is not set") {
        return NextResponse.json(
          {
            error:
              "Server is not configured with AI_GATEWAY_API_KEY (critique uses Vercel AI Gateway)",
          },
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
      console.error("[critique]", message);
      return NextResponse.json({ error: "Critique failed" }, { status: 500 });
    }

    success = true;

    if (gateContext.kind === "miss" && gateEnabled) {
      await registerDraftCritiqueRegistry(
        supabase,
        payload.fullText,
        critique,
      );
    }

    const accessAfter = await getCritiqueAccessForUser(supabase, user);
    schedulePostHogLogFlush();
    posthogLog.info("Lyric critique completed", {
      route: "/api/critique",
      gate_result: gateContext.kind,
      quota_reserved: slotReserved,
    });
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
