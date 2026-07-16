import type { User } from "@supabase/supabase-js";

/** Synthetic email for anonymous profiles (`profiles.email` is NOT NULL). */
export function guestProfileEmail(userId: string): string {
  return `anon-${userId}@guest.lineroom.local`;
}

export function isAnonymousUser(user: User | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}
