import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { getAuthUser, requireAuthUser } from "@/lib/auth/guards";

describe("getAuthUser", () => {
  it("returns user when session user exists", async () => {
    const user = { id: "u1" } as User;
    const supabase = {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
      },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(getAuthUser(supabase)).resolves.toBe(user);
  });

  it("returns null when there is no user", async () => {
    const supabase = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(getAuthUser(supabase)).resolves.toBeNull();
  });
});

describe("requireAuthUser", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("returns user when present", async () => {
    const user = { id: "u1" } as User;
    const supabase = {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
      },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(requireAuthUser(supabase)).resolves.toBe(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when user is missing", async () => {
    const supabase = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(requireAuthUser(supabase)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
