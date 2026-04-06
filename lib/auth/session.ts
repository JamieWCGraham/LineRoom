import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/guards";

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  return requireAuthUser(supabase);
}
