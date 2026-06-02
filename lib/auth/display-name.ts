import type { User } from "@supabase/supabase-js";

type ProfileNameFields = {
  display_name: string | null;
  username: string | null;
};

/** Resolves the greeting label: display_name → username → email local-part → fallback. */
export function resolveDisplayName(
  profile: ProfileNameFields | null | undefined,
  user: Pick<User, "email">,
): string {
  const fromProfile = profile?.display_name?.trim();
  if (fromProfile) return fromProfile;
  const fromUsername = profile?.username?.trim();
  if (fromUsername) return fromUsername;
  const email = user.email?.trim() ?? "";
  const at = email.indexOf("@");
  if (at > 0) return email.slice(0, at);
  if (email) return email;
  return "LineRoom user";
}
