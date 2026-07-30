import type { User } from "@supabase/supabase-js";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import type { LangfuseTraceUser } from "@/lib/langfuse-server";

/**
 * Builds Langfuse `userId` + metadata from the auth user (and optional profiles row).
 */
export function buildLangfuseTraceUser(
  user: User,
  profile?: { display_name: string | null; email: string | null } | null,
): LangfuseTraceUser {
  const normalized = normalizeAuthUserToProfile(user);
  return {
    userId: user.id,
    email: profile?.email?.trim() || normalized.email || user.email || undefined,
    displayName:
      profile?.display_name?.trim() ||
      normalized.display_name ||
      undefined,
  };
}
