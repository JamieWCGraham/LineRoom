import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { lyricSubscoresJsonSchema } from "@/lib/evals/subscoreCalibration";
import { groundTruthStrengthsWeaknessesSchema } from "@/lib/evals/strengthWeaknessGroundTruth";
import { groundTruthLineFeedbackSchema } from "@/lib/evals/lineFeedbackGroundTruth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ evalId: string }> };

const bodySchema = z
  .object({
    groundTruthSubscores: lyricSubscoresJsonSchema.optional(),
    groundTruthSubscoresApproved: z.boolean().optional(),
    groundTruthStrengthsWeaknesses: groundTruthStrengthsWeaknessesSchema.optional(),
    groundTruthStrengthsWeaknessesApproved: z.boolean().optional(),
    groundTruthLineFeedback: groundTruthLineFeedbackSchema.optional(),
    groundTruthLineFeedbackApproved: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.groundTruthSubscores != null ||
      d.groundTruthSubscoresApproved !== undefined ||
      d.groundTruthStrengthsWeaknesses != null ||
      d.groundTruthStrengthsWeaknessesApproved !== undefined ||
      d.groundTruthLineFeedback != null ||
      d.groundTruthLineFeedbackApproved !== undefined,
    { message: "At least one annotation field is required" },
  );

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

  const update: Record<string, unknown> = {};
  if (parsed.data.groundTruthSubscores != null) {
    update.ground_truth_subscores = parsed.data.groundTruthSubscores;
  }
  if (parsed.data.groundTruthSubscoresApproved !== undefined) {
    update.ground_truth_subscores_approved = parsed.data.groundTruthSubscoresApproved;
  }
  if (parsed.data.groundTruthStrengthsWeaknesses != null) {
    update.ground_truth_strengths_weaknesses = parsed.data.groundTruthStrengthsWeaknesses;
  }
  if (parsed.data.groundTruthStrengthsWeaknessesApproved !== undefined) {
    update.ground_truth_strengths_weaknesses_approved =
      parsed.data.groundTruthStrengthsWeaknessesApproved;
  }
  if (parsed.data.groundTruthLineFeedback != null) {
    update.ground_truth_line_feedback = parsed.data.groundTruthLineFeedback;
  }
  if (parsed.data.groundTruthLineFeedbackApproved !== undefined) {
    update.ground_truth_line_feedback_approved = parsed.data.groundTruthLineFeedbackApproved;
  }

  const { error } = await admin
    .from("generate_critique_eval_set")
    .update(update)
    .eq("id", idNum);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return NextResponse.json(
        {
          error: "HITL schema columns missing",
          detail: "Run Supabase migrations for ground-truth annotation columns.",
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
