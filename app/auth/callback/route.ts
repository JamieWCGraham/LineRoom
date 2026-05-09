import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import {
  OAUTH_NEXT_COOKIE,
  getSiteUrl,
  sanitizeAuthNext,
} from "@/lib/auth/oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const site = getSiteUrl();
  const jar = await cookies();
  const fromCookie = jar.get(OAUTH_NEXT_COOKIE)?.value;
  const next = sanitizeAuthNext(fromCookie);

  if (!code) {
    const res = NextResponse.redirect(
      new URL("/login?error=oauth_callback", site),
    );
    res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const res = NextResponse.redirect(
      new URL("/login?error=oauth_callback", site),
    );
    res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
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

  const res = NextResponse.redirect(new URL(next, site));
  res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
