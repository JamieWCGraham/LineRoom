import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "@/app/auth/oauth/route";

const idpUrl =
  "https://xyz.supabase.co/auth/v1/authorize?provider=google&redirect_to=lineroom";

function mockSupabase(opts: {
  user?: User | null;
  signInUrl?: string | null;
  signInError?: Error | null;
  linkUrl?: string | null;
  linkError?: Error | null;
}) {
  const signInWithOAuth = vi.fn().mockResolvedValue({
    data: { url: opts.signInUrl ?? idpUrl },
    error: opts.signInError ?? null,
  });
  const linkIdentity = vi.fn().mockResolvedValue({
    data: { url: opts.linkUrl ?? idpUrl },
    error: opts.linkError ?? null,
  });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
      }),
      signInWithOAuth,
      linkIdentity,
    },
  };
  mockCreateClient.mockResolvedValue(supabase);
  return { supabase, signInWithOAuth, linkIdentity };
}

describe("GET /auth/oauth", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    if (originalSite === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSite;
    }
  });

  it("returns JSON IdP url for native=1 and uses custom-scheme redirectTo", async () => {
    const { signInWithOAuth } = mockSupabase({});
    const req = new NextRequest(
      "https://app.example.com/auth/oauth?provider=google&native=1",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe(idpUrl);
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: "lineroom://auth/callback",
        }),
      }),
    );
  });

  it("sets lr_oauth_next cookie on native JSON start when next is set", async () => {
    mockSupabase({});
    const req = new NextRequest(
      "https://app.example.com/auth/oauth?provider=google&native=1&next=%2Faccount",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const joined = setCookie.join("\n") || res.headers.get("set-cookie") || "";
    expect(joined).toMatch(/lr_oauth_next=%2Faccount/);
  });

  it("redirects to IdP for web (non-native) with HTTPS callback", async () => {
    const { signInWithOAuth } = mockSupabase({
      signInUrl: "https://xyz.supabase.co/auth/v1/authorize?provider=google",
    });
    const req = new NextRequest(
      "https://app.example.com/auth/oauth?provider=google",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("supabase.co");
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: "https://app.example.com/auth/callback",
        }),
      }),
    );
  });

  it("returns 400 JSON for invalid provider when native=1", async () => {
    mockSupabase({});
    const req = new NextRequest(
      "https://app.example.com/auth/oauth?provider=github&native=1",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "oauth_provider" });
  });

  it("uses linkIdentity for anonymous users", async () => {
    const anon = {
      id: "anon-1",
      is_anonymous: true,
    } as User;
    const { linkIdentity, signInWithOAuth } = mockSupabase({ user: anon });
    const req = new NextRequest(
      "https://app.example.com/auth/oauth?provider=apple&native=1",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(linkIdentity).toHaveBeenCalled();
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});
