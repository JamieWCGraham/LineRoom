import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { CritiqueAccessState } from "@/lib/billing/types";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetCritiqueAccessForUser = vi.hoisted(() => vi.fn());
const mockReconcileSubscriptionForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/billing/access", () => ({
  getCritiqueAccessForUser: mockGetCritiqueAccessForUser,
}));

vi.mock("@/lib/billing/reconcile", () => ({
  reconcileSubscriptionForUser: mockReconcileSubscriptionForUser,
}));

vi.mock("@/lib/billing/stripe-sync", () => ({
  upsertSubscriptionFromStripe: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { GET } from "@/app/api/billing/access/route";

const testUser = { id: "user-1", email: "test@example.com" } as User;

const subscribedAccess: CritiqueAccessState = {
  isBypassed: false,
  hasActiveSubscription: true,
  freeQuota: 5,
  usedFreeCritiques: 2,
  remainingFreeCritiques: 3,
  canGenerateCritique: true,
  reason: "subscribed",
  currentPeriodEnd: "2026-06-01T00:00:00.000Z",
  subscriptionBillingProvider: "stripe",
};

const unauthenticatedAccess: CritiqueAccessState = {
  isBypassed: false,
  hasActiveSubscription: false,
  freeQuota: 5,
  usedFreeCritiques: 0,
  remainingFreeCritiques: 0,
  canGenerateCritique: false,
  reason: "unauthenticated",
  currentPeriodEnd: null,
  subscriptionBillingProvider: null,
};

function mockSupabase(user: User | null) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
  mockCreateClient.mockResolvedValue(supabase);
  return supabase;
}

describe("GET /api/billing/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReconcileSubscriptionForUser.mockResolvedValue({
      attempted: false,
      hasPaidSubscription: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns unauthenticated access when there is no session user", async () => {
    mockSupabase(null);
    mockGetCritiqueAccessForUser.mockResolvedValue(unauthenticatedAccess);

    const res = await GET(new Request("http://localhost/api/billing/access"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ access: unauthenticatedAccess });
    expect(mockGetCritiqueAccessForUser).toHaveBeenCalledWith(
      expect.anything(),
      null,
    );
    expect(mockReconcileSubscriptionForUser).not.toHaveBeenCalled();
  });

  it("returns access shape for an authenticated user", async () => {
    mockSupabase(testUser);
    mockGetCritiqueAccessForUser.mockResolvedValue(subscribedAccess);

    const res = await GET(
      new Request("http://localhost/api/billing/access?sync=1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ access: subscribedAccess });
    expect(body.access).toMatchObject({
      canGenerateCritique: true,
      reason: "subscribed",
      hasActiveSubscription: true,
      freeQuota: expect.any(Number),
      remainingFreeCritiques: expect.any(Number),
    });
    expect(mockReconcileSubscriptionForUser).toHaveBeenCalledWith(
      testUser.id,
      testUser.email,
    );
    expect(mockGetCritiqueAccessForUser).toHaveBeenCalledWith(
      expect.anything(),
      testUser,
    );
  });
});
