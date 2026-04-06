import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getAuthUser(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuthUser(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<User> {
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");
  return user;
}
