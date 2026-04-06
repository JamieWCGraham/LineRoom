import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getSiteUrl } from "@/lib/auth/oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const site = getSiteUrl();

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", site));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", site));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      await ensureProfile(supabase, user);
    } catch {
      /* logged in; profile can be fixed from /account */
    }
  }

  return NextResponse.redirect(new URL(next, site));
}
