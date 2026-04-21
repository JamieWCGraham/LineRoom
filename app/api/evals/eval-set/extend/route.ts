import { NextResponse } from "next/server";
import { z } from "zod";
import { evalSongInputSchema } from "@/lib/evals/evalSongInput";
import { extendEvalSetWithLyrics } from "@/lib/evals/extendEvalSetPipeline";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  rows: z.array(evalSongInputSchema).min(1).max(50),
});

/**
 * Fetches lyrics (lyrics.ovh + LRCLIB), inserts into `generate_critique_eval_set`.
 * Billing-bypass sessions only (same as other eval APIs).
 */
export async function POST(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Config error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const results = await extendEvalSetWithLyrics(admin, parsed.data.rows);
  return NextResponse.json({ results });
}
