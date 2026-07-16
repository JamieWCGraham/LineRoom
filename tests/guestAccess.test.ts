import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCritiqueAccessForUser } from "@/lib/billing/access";

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    aud: "authenticated",
    role: "authenticated",
    email: "user@example.com",
    phone: "",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
    ...overrides,
  } as User;
}

function mockUsageClient(used: number) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { successful_critiques_used: used },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

describe("getCritiqueAccessForUser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns unauthenticated shape with isAnonymous false", async () => {
    const access = await getCritiqueAccessForUser(
      { from: vi.fn() } as unknown as SupabaseClient,
      null,
    );
    expect(access.reason).toBe("unauthenticated");
    expect(access.isAnonymous).toBe(false);
    expect(access.canGenerateCritique).toBe(false);
  });

  it("applies guest quota for anonymous users", async () => {
    vi.stubEnv("GUEST_CRITIQUE_QUOTA", "3");
    const supabase = mockUsageClient(1);
    const access = await getCritiqueAccessForUser(
      supabase,
      baseUser({ is_anonymous: true, email: undefined }),
    );
    expect(access.isAnonymous).toBe(true);
    expect(access.freeQuota).toBe(3);
    expect(access.usedFreeCritiques).toBe(1);
    expect(access.remainingFreeCritiques).toBe(2);
    expect(access.canGenerateCritique).toBe(true);
    expect(access.reason).toBe("free_remaining");
  });

  it("exhausts guest quota", async () => {
    vi.stubEnv("GUEST_CRITIQUE_QUOTA", "3");
    const supabase = mockUsageClient(3);
    const access = await getCritiqueAccessForUser(
      supabase,
      baseUser({ is_anonymous: true, email: undefined }),
    );
    expect(access.canGenerateCritique).toBe(false);
    expect(access.reason).toBe("quota_exhausted");
    expect(access.isAnonymous).toBe(true);
  });
});
