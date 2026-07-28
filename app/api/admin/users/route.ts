import { NextResponse } from "next/server";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const USER_LIST_LIMIT = 500;

export type AdminUserListItem = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

/**
 * `GET /api/admin/users?q=`
 *
 * Lists profiles for the admin user-delete dropdown. Requires evals access.
 */
export async function GET(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

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

  let query = admin
    .from("profiles")
    .select("id, email, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(USER_LIST_LIMIT);

  if (q) {
    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`email.ilike.${pattern},display_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users: AdminUserListItem[] = (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    createdAt: row.created_at as string,
  }));

  return NextResponse.json({ users });
}
