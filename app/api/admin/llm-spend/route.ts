import { NextResponse } from "next/server";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { isLangfuseEnabled } from "@/lib/langfuse-server";
import {
  fetchUserLlmSpend,
  type LangfuseSpendSlice,
} from "@/lib/langfuse/metrics";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminLlmSpendResponse = {
  configured: boolean;
  userId: string;
  email: string;
  displayName: string | null;
  from: string;
  to: string;
  total: LangfuseSpendSlice;
  chat: LangfuseSpendSlice;
  critique: LangfuseSpendSlice;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_PRESETS = new Set([7, 30, 90]);

function parseRange(url: URL): { from: string; to: string } | { error: string } {
  const toParam = url.searchParams.get("to")?.trim();
  const fromParam = url.searchParams.get("from")?.trim();
  const daysRaw = url.searchParams.get("days")?.trim();

  const to = toParam ? new Date(toParam) : new Date();
  if (Number.isNaN(to.getTime())) {
    return { error: "Invalid `to` timestamp." };
  }

  let from: Date;
  if (fromParam) {
    from = new Date(fromParam);
    if (Number.isNaN(from.getTime())) {
      return { error: "Invalid `from` timestamp." };
    }
  } else {
    const days = daysRaw ? Number(daysRaw) : 30;
    if (!ALLOWED_PRESETS.has(days)) {
      return { error: "`days` must be 7, 30, or 90." };
    }
    from = new Date(to.getTime() - days * DAY_MS);
  }

  if (from.getTime() >= to.getTime()) {
    return { error: "`from` must be before `to`." };
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * `GET /api/admin/llm-spend?userId=` or `?email=` + optional `days` (7|30|90) or `from`/`to`
 *
 * On-demand Langfuse spend for one user. Requires evals access.
 */
export async function GET(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  if (!isLangfuseEnabled()) {
    return NextResponse.json(
      {
        error: "Langfuse is not configured",
        configured: false,
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId")?.trim() ?? "";
  const emailParam = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!userIdParam && !emailParam) {
    return NextResponse.json(
      { error: "Provide `userId` or `email`." },
      { status: 400 },
    );
  }

  const range = parseRange(url);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 500 },
    );
  }

  let profileQuery = admin.from("profiles").select("id, email, display_name");
  if (userIdParam) {
    profileQuery = profileQuery.eq("id", userIdParam);
  } else {
    profileQuery = profileQuery.ilike("email", emailParam);
  }

  const { data: profile, error: profileError } = await profileQuery.maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const userId = profile.id as string;
  const email = (profile.email as string) ?? "";
  const displayName = (profile.display_name as string | null) ?? null;

  try {
    const spend = await fetchUserLlmSpend({
      userId,
      fromTimestamp: range.from,
      toTimestamp: range.to,
    });
    const body: AdminLlmSpendResponse = {
      configured: true,
      userId,
      email,
      displayName,
      from: range.from,
      to: range.to,
      total: spend.total,
      chat: spend.chat,
      critique: spend.critique,
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Langfuse request failed";
    console.error("[admin/llm-spend]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
