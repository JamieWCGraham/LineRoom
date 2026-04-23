import { NextResponse } from "next/server";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { getFreeCritiqueQuota } from "@/lib/billing/config";
import type { CritiqueAccessState } from "@/lib/billing/types";
import { getAuthUser } from "@/lib/auth/guards";
import { runCritiqueModel } from "@/lib/critique/runCritiqueModel";
import type { CritiqueResult } from "@/lib/types";
import { critiqueRequestSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase/server";

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

    const payload = parsed.data;
    let critique: CritiqueResult;
    try {
      ({ critique } = await runCritiqueModel(payload));
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
