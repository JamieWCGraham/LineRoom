import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/oauth";

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const site = getSiteUrl();
  const dest = new URL("/login", site);
  dest.searchParams.set("message", "signed_out");
  return NextResponse.redirect(dest);
}
