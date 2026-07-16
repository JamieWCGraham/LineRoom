import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAnonymousUser } from "@/lib/auth/guest";

export async function getAuthUser(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Requires a non-anonymous signed-in user (dashboard, account, cloud songs). */
export async function requireAuthUser(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<User> {
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");
  if (isAnonymousUser(user)) redirect("/signup");
  return user;
}
