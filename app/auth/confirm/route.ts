import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getSiteUrl } from "@/lib/auth/oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const site = getSiteUrl();
  const supabase = await createClient();

  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await ensureProfile(supabase, user);
        } catch {
          /* continue to dashboard */
        }
      }
      return NextResponse.redirect(new URL("/", site));
    }
  }

  const code = requestUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await ensureProfile(supabase, user);
        } catch {
          /* continue */
        }
      }
      return NextResponse.redirect(new URL("/", site));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirm", site));
}
