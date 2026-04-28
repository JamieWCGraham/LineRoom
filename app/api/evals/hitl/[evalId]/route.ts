import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { lyricSubscoresJsonSchema } from "@/lib/evals/subscoreCalibration";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ evalId: string }> };

const bodySchema = z.object({
  groundTruthSubscores: lyricSubscoresJsonSchema,
  approved: z.boolean().optional(),
});

function isMissingColumnError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const { evalId } = await params;
  const idNum = Number.parseInt(evalId, 10);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.json({ error: "Invalid evalId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
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

  const { error } = await admin
    .from("generate_critique_eval_set")
    .update({
      ground_truth_subscores: parsed.data.groundTruthSubscores,
      ...(parsed.data.approved !== undefined ?
        { ground_truth_subscores_approved: parsed.data.approved }
      : {}),
    })
    .eq("id", idNum);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return NextResponse.json(
        {
          error: "HITL schema columns missing",
          detail: "Run Supabase migrations to add ground_truth_subscores columns.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update annotation", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: idNum });
}
