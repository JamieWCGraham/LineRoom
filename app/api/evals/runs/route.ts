import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getLineRoomEvalsBucket } from "@/lib/evals/bucket";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";

/**
 * Lists evaluation run folder names (timestamp keys) in the eval bucket.
 */
export async function GET() {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

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
  const { data, error } = await admin.storage.from(bucket).list("", {
    limit: 500,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to list runs", detail: error.message },
      { status: 500 },
    );
  }

  const runFolder = /^\d{4}-\d{2}-\d{2}T/;
  const runs = (data ?? [])
    .map((f) => f.name)
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name.length > 0 &&
        !name.startsWith(".") &&
        runFolder.test(name),
    );

  return NextResponse.json({ runs });
}
