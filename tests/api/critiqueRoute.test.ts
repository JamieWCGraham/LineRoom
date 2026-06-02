import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { CritiqueAccessState } from "@/lib/billing/types";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetAuthUser = vi.hoisted(() => vi.fn());
const mockGetCritiqueAccessForUser = vi.hoisted(() => vi.fn());
const mockRunCritiqueModel = vi.hoisted(() => vi.fn());
const mockLookupDraftCritiqueRegistry = vi.hoisted(() => vi.fn());
const mockRegisterDraftCritiqueRegistry = vi.hoisted(() => vi.fn());
const mockIsDraftCritiqueGateEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/billing/access", () => ({
  getCritiqueAccessForUser: mockGetCritiqueAccessForUser,
}));

vi.mock("@/lib/critique/draftCritiqueGateConfig", () => ({
  isDraftCritiqueGateEnabled: mockIsDraftCritiqueGateEnabled,
}));

vi.mock("@/lib/critique/draftCritiqueGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/critique/draftCritiqueGate")>();
  return {
    ...actual,
    lookupDraftCritiqueRegistry: mockLookupDraftCritiqueRegistry,
    registerDraftCritiqueRegistry: mockRegisterDraftCritiqueRegistry,
  };
});

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

function mockSupabase(profile: { display_name: string | null; email: string | null } | null = null) {
  const profileMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: profile, error: null });
  const profileEq = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: profileSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  const supabase = {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
    from,
  };
  mockCreateClient.mockResolvedValue(supabase);
  return supabase;
}

describe("POST /api/critique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase();
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockIsDraftCritiqueGateEnabled.mockReturnValue(true);
    mockLookupDraftCritiqueRegistry.mockResolvedValue({ kind: "miss" });
    mockRegisterDraftCritiqueRegistry.mockResolvedValue(undefined);
    mockRunCritiqueModel.mockResolvedValue({
      critique: {
        genrePrinciples: "g",
        overallRatingBand: "Strong",
        subscores: {
          emotional_impact: 4,
          imagery_specificity: 4,
          originality_voice: 4,
          prosody_singability: 4,
          structure_cohesion: 4,
          lyrical_economy: 4,
          hook_strength: 4,
        },
        overallStrengths: [],
        overallWeaknesses: [],
        lineFeedback: [],
      },
    });
    mockGetCritiqueAccessForUser.mockResolvedValue(allowedAccess);
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

  it("runs gate lookup in parallel and registers on miss", async () => {
    mockGetAuthUser.mockResolvedValue(testUser);

    const res = await POST(
      new Request("http://localhost/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "line one ".repeat(20),
          title: "",
          similarArtists: "",
          genre: "",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockLookupDraftCritiqueRegistry).toHaveBeenCalled();
    expect(mockRunCritiqueModel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        gate: { kind: "miss" },
        traceUser: {
          userId: "user-1",
          email: "test@example.com",
          displayName: "test",
        },
      }),
    );
    expect(mockRegisterDraftCritiqueRegistry).toHaveBeenCalled();
  });

  it("passes gate hit context to runCritiqueModel", async () => {
    mockGetAuthUser.mockResolvedValue(testUser);
    const canonical = {
      overallRatingBand: "Promising" as const,
      subscores: {
        emotional_impact: 3 as const,
        imagery_specificity: 3 as const,
        originality_voice: 3 as const,
        prosody_singability: 3 as const,
        structure_cohesion: 3 as const,
        lyrical_economy: 3 as const,
        hook_strength: 3 as const,
      },
    };
    mockLookupDraftCritiqueRegistry.mockResolvedValue({
      kind: "hit",
      canonical,
      fingerprintPrefix: "deadbeef",
    });

    const res = await POST(
      new Request("http://localhost/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "line one ".repeat(20),
          title: "",
          similarArtists: "",
          genre: "",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRunCritiqueModel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        gate: {
          kind: "hit",
          canonical,
          fingerprintPrefix: "deadbeef",
        },
      }),
    );
    expect(mockRegisterDraftCritiqueRegistry).not.toHaveBeenCalled();
  });
});
