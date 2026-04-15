import { NextResponse } from "next/server";
import { computeEvalRunMetrics } from "@/lib/evals/computeEvalRunMetrics";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";

type Params = { params: Promise<{ runId: string }> };

/**
 * Exact-match accuracy: LLM `critique.overallRatingBand` vs table `overall_score`
 * for each row in `generate_critique_eval_set` that has a stored `output.json` for this run.
 *
 * Requires session email in `BILLING_BYPASS_EMAILS`.
 */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const { runId } = await params;
  if (!runId || runId.includes("..") || runId.includes("/")) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  const result = await computeEvalRunMetrics(runId);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.error === "Failed to load eval set" ? 500 : 503 },
    );
  }

  return NextResponse.json(result);
}
