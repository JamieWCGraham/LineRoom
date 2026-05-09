import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ProfileUpsert } from "@/types/database";

function emailPrefix(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function inferProvider(user: User): string {
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    typeof meta?.provider === "string" ? meta.provider : undefined;
  if (fromMeta) return fromMeta;

  const identities = user.identities;
  if (identities && identities.length > 0) {
    const p = identities[0]?.provider;
    if (typeof p === "string") return p;
  }

  return "email";
}

function pickDisplayName(user: User, email: string): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;
  const name = typeof meta?.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  const rawNameObj = meta?.name;
  if (rawNameObj && typeof rawNameObj === "object" && rawNameObj !== null) {
    const obj = rawNameObj as Record<string, unknown>;
    const first =
      typeof obj.firstName === "string" ? obj.firstName.trim() : "";
    const last =
      typeof obj.lastName === "string" ? obj.lastName.trim() : "";
    const appleCombined = [first, last].filter(Boolean).join(" ").trim();
    if (appleCombined) return appleCombined;
  }
  const given =
    typeof meta?.given_name === "string" ? meta.given_name.trim() : "";
  const family =
    typeof meta?.family_name === "string" ? meta.family_name.trim() : "";
  const oidcCombined = [given, family].filter(Boolean).join(" ").trim();
  if (oidcCombined) return oidcCombined;
  const userName =
    typeof meta?.user_name === "string" ? meta.user_name.trim() : "";
  if (userName) return userName;
  return emailPrefix(email);
}

export function normalizeAuthUserToProfile(user: User): ProfileUpsert {
  const email = user.email ?? "";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const avatar =
    typeof meta?.avatar_url === "string" ? meta.avatar_url : null;
  return {
    id: user.id,
    email,
    display_name: pickDisplayName(user, email),
    avatar_url: avatar,
    auth_provider: inferProvider(user),
    updated_at: new Date().toISOString(),
  };
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const row = normalizeAuthUserToProfile(user);
  const { error } = await supabase.from("profiles").upsert(
    {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      auth_provider: row.auth_provider,
      updated_at: row.updated_at,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}
