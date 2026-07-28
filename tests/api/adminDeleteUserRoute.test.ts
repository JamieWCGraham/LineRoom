import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireBillingBypassSession = vi.hoisted(() => vi.fn());
const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());
const mockDeleteUserAndData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/evals/requireBillingBypassSession", () => ({
  requireBillingBypassSession: mockRequireBillingBypassSession,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/account/deleteUserData", () => ({
  deleteUserAndData: mockDeleteUserAndData,
}));

vi.mock("@/lib/billing/logger", () => ({
  billingLog: { info: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/admin/users/delete/route";

describe("POST /api/admin/users/delete", () => {
  const adminUserId = "admin-1";
  const targetUserId = "target-1";
  const mockGetUserById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: true,
      email: "admin@example.com",
      userId: adminUserId,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: targetUserId, email: "target@example.com" } },
      error: null,
    });
    mockDeleteUserAndData.mockResolvedValue({ ok: true });
    mockCreateServiceRoleClient.mockReturnValue({
      auth: { admin: { getUserById: mockGetUserById } },
    });
  });

  it("returns 400 when admin tries to delete own account", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: adminUserId,
          confirmEmail: "admin@example.com",
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("own account"),
    });
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm email does not match", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          confirmEmail: "wrong@example.com",
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Email confirmation does not match the selected user.",
    });
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });

  it("calls deleteUserAndData when confirmation matches", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          confirmEmail: "target@example.com",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDeleteUserAndData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: targetUserId,
        userEmail: "target@example.com",
        acknowledgeAppStoreSub: true,
      }),
    );
  });
});
