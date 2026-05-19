import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { CritiqueAccessState } from "@/lib/billing/types";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetAuthUser = vi.hoisted(() => vi.fn());
const mockGetCritiqueAccessForUser = vi.hoisted(() => vi.fn());
const mockRunCritiqueModel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/billing/access", () => ({
  getCritiqueAccessForUser: mockGetCritiqueAccessForUser,
}));

vi.mock("@/lib/critique/runCritiqueModel", () => ({
  runCritiqueModel: mockRunCritiqueModel,
}));

import { POST } from "@/app/api/critique/route";

const testUser = { id: "user-1", email: "test@example.com" } as User;

const allowedAccess: CritiqueAccessState = {
  isBypassed: false,
  hasActiveSubscription: true,
  freeQuota: 5,
  usedFreeCritiques: 0,
  remainingFreeCritiques: 5,
  canGenerateCritique: true,
  reason: "subscribed",
  currentPeriodEnd: null,
  subscriptionBillingProvider: "stripe",
};

const paywalledAccess: CritiqueAccessState = {
  isBypassed: false,
  hasActiveSubscription: false,
  freeQuota: 5,
  usedFreeCritiques: 5,
  remainingFreeCritiques: 0,
  canGenerateCritique: false,
  reason: "quota_exhausted",
  currentPeriodEnd: null,
  subscriptionBillingProvider: null,
};

function mockSupabase() {
  const supabase = {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  };
  mockCreateClient.mockResolvedValue(supabase);
  return supabase;
}

describe("POST /api/critique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase();
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "line one",
          title: "",
          similarArtists: "",
          genre: "",
        }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockGetCritiqueAccessForUser).not.toHaveBeenCalled();
  });

  it("returns 402 when critique access is blocked", async () => {
    mockGetAuthUser.mockResolvedValue(testUser);
    mockGetCritiqueAccessForUser.mockResolvedValue(paywalledAccess);

    const res = await POST(
      new Request("http://localhost/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "line one",
          title: "",
          similarArtists: "",
          genre: "",
        }),
      }),
    );

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("PAYWALL_REQUIRED");
    expect(body.checkoutRequired).toBe(true);
    expect(body.access).toEqual(paywalledAccess);
    expect(mockRunCritiqueModel).not.toHaveBeenCalled();
  });

  it("returns 400 when request body fails validation", async () => {
    mockGetAuthUser.mockResolvedValue(testUser);
    mockGetCritiqueAccessForUser.mockResolvedValue(allowedAccess);

    const res = await POST(
      new Request("http://localhost/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "",
          title: "",
          similarArtists: "",
          genre: "",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(mockRunCritiqueModel).not.toHaveBeenCalled();
  });
});
