import { NextResponse } from "next/server";
import { getCritiqueAccessForUser } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCritiqueAccessForUser(supabase, user);
  return NextResponse.json({ access });
}
