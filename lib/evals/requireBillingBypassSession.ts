import { NextResponse } from "next/server";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { isBillingBypassed } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";

export async function requireBillingBypassSession(): Promise<
  | { ok: true; email: string; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const { email } = normalizeAuthUserToProfile(user);
  if (!isBillingBypassed(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, email, userId: user.id };
}
