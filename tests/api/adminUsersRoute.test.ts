import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireBillingBypassSession = vi.hoisted(() => vi.fn());
const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/evals/requireBillingBypassSession", () => ({
  requireBillingBypassSession: mockRequireBillingBypassSession,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

import { GET } from "@/app/api/admin/users/route";

describe("GET /api/admin/users", () => {
  const mockSelect = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockOr = vi.fn();

  function buildLimitResult(data: unknown[] = []) {
    return {
      or: mockOr,
      then(
        onFulfilled?: (value: { data: unknown[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: true,
      email: "admin@example.com",
      userId: "admin-1",
    });
    mockOr.mockResolvedValue({ data: [], error: null });
    mockLimit.mockImplementation(() => buildLimitResult());
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockCreateServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ select: mockSelect })),
    });
  });

  it("returns 401 when session gate fails", async () => {
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(new Request("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when evals access is denied", async () => {
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
    });

    const res = await GET(new Request("http://localhost/api/admin/users"));
    expect(res.status).toBe(403);
  });

  it("returns mapped users when allowed", async () => {
    mockLimit.mockImplementation(() =>
      buildLimitResult([
        {
          id: "u-1",
          email: "user@example.com",
          display_name: "Test User",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const res = await GET(new Request("http://localhost/api/admin/users"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      users: [
        {
          id: "u-1",
          email: "user@example.com",
          displayName: "Test User",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(mockSelect).toHaveBeenCalledWith(
      "id, email, display_name, created_at",
    );
  });

  it("applies search filter when q is provided", async () => {
    mockOr.mockResolvedValue({ data: [], error: null });

    await GET(new Request("http://localhost/api/admin/users?q=jamie"));

    expect(mockOr).toHaveBeenCalledWith(
      "email.ilike.%jamie%,display_name.ilike.%jamie%",
    );
  });
});
