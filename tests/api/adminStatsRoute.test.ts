import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireBillingBypassSession = vi.hoisted(() => vi.fn());
const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/evals/requireBillingBypassSession", () => ({
  requireBillingBypassSession: mockRequireBillingBypassSession,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

import { GET } from "@/app/api/admin/stats/route";

describe("GET /api/admin/stats", () => {
  const mockProfilesSelect = vi.fn();
  const mockProfilesOrder = vi.fn();
  const mockSongsSelect = vi.fn();
  const mockSongsNot = vi.fn();
  const mockSubscriptionsSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: true,
      email: "admin@example.com",
      userId: "admin-1",
    });

    mockProfilesOrder.mockResolvedValue({
      data: [
        {
          id: "u-1",
          email: "user@example.com",
          display_name: "Test User",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "u-2",
          email: "anon-u-2@guest.lineroom.local",
          display_name: null,
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mockProfilesSelect.mockReturnValue({ order: mockProfilesOrder });

    mockSongsNot.mockResolvedValue({ count: 1, error: null });

    mockSongsSelect.mockImplementation(
      (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (!opts?.head) {
          return Promise.resolve({
            data: [{ user_id: "u-1" }, { user_id: "u-1" }],
            error: null,
          });
        }
        return {
          not: mockSongsNot,
          then(
            onFulfilled?: (value: { count: number; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({ count: 2, error: null }).then(
              onFulfilled,
              onRejected,
            );
          },
        };
      },
    );

    mockSubscriptionsSelect.mockResolvedValue({
      data: [
        {
          user_id: "u-1",
          status: "active",
          billing_provider: "stripe",
          current_period_end: "2026-12-01T00:00:00.000Z",
          cancel_at_period_end: false,
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_1",
          email: "user@example.com",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    mockCreateServiceRoleClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: mockProfilesSelect };
        }
        if (table === "songs") {
          return { select: mockSongsSelect };
        }
        if (table === "subscriptions") {
          return { select: mockSubscriptionsSelect };
        }
        return { select: vi.fn() };
      }),
    });
  });

  it("returns 401 when session gate fails", async () => {
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns aggregate stats when allowed", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalUsers).toBe(2);
    expect(body.registeredUsers).toBe(1);
    expect(body.guestUsers).toBe(1);
    expect(body.proUsers).toBe(1);
    expect(body.paidProUsers).toBe(1);
    expect(body.bypassProUsers).toBe(0);
    expect(body.totalSongs).toBe(2);
    expect(body.publishedSongs).toBe(1);
    expect(body.usersWithSongs).toBe(1);
    expect(body.avgSongsPerRegisteredUser).toBe(2);
    expect(body.songCountBuckets).toEqual([
      { label: "0 songs", min: 0, max: 0, userCount: 0 },
      { label: "1 song", min: 1, max: 1, userCount: 0 },
      { label: "2–5 songs", min: 2, max: 5, userCount: 1 },
      { label: "6–10 songs", min: 6, max: 10, userCount: 0 },
      { label: "11+ songs", min: 11, max: null, userCount: 0 },
    ]);
    expect(body.users[0]).toMatchObject({
      id: "u-1",
      email: "user@example.com",
      songCount: 2,
      isGuest: false,
      isPro: true,
      isBillingBypass: false,
    });
  });

  it("counts billing-bypass emails as Pro access", async () => {
    vi.stubEnv("BILLING_BYPASS_EMAILS", "user@example.com");
    mockSubscriptionsSelect.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.paidProUsers).toBe(0);
    expect(body.bypassProUsers).toBe(1);
    expect(body.proUsers).toBe(1);
    expect(body.users[0]).toMatchObject({
      email: "user@example.com",
      isPro: false,
      isBillingBypass: true,
    });

    vi.unstubAllEnvs();
  });
});
