import { describe, it, expect, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeAuthUserToProfile,
  ensureProfile,
} from "@/lib/auth/profile";

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "user@example.com",
    phone: "",
    confirmed_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
    ...overrides,
  } as User;
}

describe("normalizeAuthUserToProfile", () => {
  it("maps email/password user to provider email", () => {
    const row = normalizeAuthUserToProfile(
      baseUser({
        email: "a@b.com",
        app_metadata: {},
        identities: [],
      }),
    );
    expect(row.auth_provider).toBe("email");
    expect(row.email).toBe("a@b.com");
  });

  it("prefers full_name for Google-style metadata", () => {
    const row = normalizeAuthUserToProfile(
      baseUser({
        email: "g@example.com",
        app_metadata: { provider: "google" },
        user_metadata: {
          full_name: "Jane Doe",
          avatar_url: "https://example.com/a.png",
        },
        identities: [{ provider: "google" } as never],
      }),
    );
    expect(row.display_name).toBe("Jane Doe");
    expect(row.auth_provider).toBe("google");
    expect(row.avatar_url).toBe("https://example.com/a.png");
  });

  it("uses Apple-style nested name object when present", () => {
    const row = normalizeAuthUserToProfile(
      baseUser({
        email: "apple@privaterelay.example.com",
        app_metadata: { provider: "apple" },
        user_metadata: {
          name: { firstName: "Pat", lastName: "Smith" },
        },
        identities: [{ provider: "apple" } as never],
      }),
    );
    expect(row.display_name).toBe("Pat Smith");
    expect(row.auth_provider).toBe("apple");
  });

  it("falls back to user_name for GitHub-style metadata", () => {
    const row = normalizeAuthUserToProfile(
      baseUser({
        email: "gh@example.com",
        app_metadata: { provider: "github" },
        user_metadata: { user_name: "octocat" },
        identities: [{ provider: "github" } as never],
      }),
    );
    expect(row.display_name).toBe("octocat");
    expect(row.auth_provider).toBe("github");
  });

  it("uses email local part when names are missing", () => {
    const row = normalizeAuthUserToProfile(
      baseUser({
        email: "localpart@domain.test",
        user_metadata: {},
      }),
    );
    expect(row.display_name).toBe("localpart");
  });

  it("maps anonymous users to guest profile fields", () => {
    const user = baseUser({
      email: undefined,
      is_anonymous: true,
      app_metadata: { provider: "anonymous" },
      identities: [],
    });
    const row = normalizeAuthUserToProfile(user);
    expect(row.display_name).toBe("Guest");
    expect(row.auth_provider).toBe("anonymous");
    expect(row.email).toBe(`anon-${user.id}@guest.lineroom.local`);
  });
});

describe("ensureProfile", () => {
  it("calls upsert with normalized shape and onConflict id", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as unknown as SupabaseClient;
    const user = baseUser({ email: "x@y.com" });

    await ensureProfile(supabase, user);

    expect(from).toHaveBeenCalledWith("profiles");
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0];
    const opts = upsert.mock.calls[0][1];
    expect(payload).toMatchObject({
      id: user.id,
      email: "x@y.com",
      display_name: "x",
      auth_provider: "email",
    });
    expect(opts).toEqual({ onConflict: "id" });
  });

  it("is idempotent by contract (repeat upsert on same id)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as unknown as SupabaseClient;
    const user = baseUser();

    await ensureProfile(supabase, user);
    await ensureProfile(supabase, user);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].id).toBe(upsert.mock.calls[1][0].id);
  });
});
