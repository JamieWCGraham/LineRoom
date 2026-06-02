import { after, NextResponse } from "next/server";
import { createEvalRunTimestamp } from "@/lib/evals/runId";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { runEvalBatchForAllRows } from "@/lib/evals/runEvalBatch";

export const maxDuration = 300;

/**
 * Starts an async full-table critique eval run. Writes to Supabase Storage
 * bucket (default `line-room-evals`): `{runTimestamp}/{evalSetId}/output.json`.
 *
 * Allowed only for sessions whose email has evals access (`EVALS_ACCESS_EMAILS`).
 */
export async function POST() {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const runTimestamp = createEvalRunTimestamp();

  after(async () => {
    await runEvalBatchForAllRows(runTimestamp);
  });

  return NextResponse.json({
    runTimestamp,
    message:
      "Batch started. Outputs are written to storage as each row completes.",
  });
}
