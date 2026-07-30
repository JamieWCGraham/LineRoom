import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireBillingBypassSession = vi.hoisted(() => vi.fn());
const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());
const mockFetchUserLlmSpend = vi.hoisted(() => vi.fn());
const mockIsLangfuseEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/evals/requireBillingBypassSession", () => ({
  requireBillingBypassSession: mockRequireBillingBypassSession,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/langfuse/metrics", () => ({
  fetchUserLlmSpend: mockFetchUserLlmSpend,
}));

vi.mock("@/lib/langfuse-server", () => ({
  isLangfuseEnabled: mockIsLangfuseEnabled,
}));

import { GET } from "@/app/api/admin/llm-spend/route";

describe("GET /api/admin/llm-spend", () => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockIlike = vi.fn();
  const mockSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: true,
      email: "admin@example.com",
      userId: "admin-1",
    });
    mockIsLangfuseEnabled.mockReturnValue(true);
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockIlike.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq, ilike: mockIlike });
    mockCreateServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ select: mockSelect })),
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        display_name: "User",
      },
      error: null,
    });
    mockFetchUserLlmSpend.mockResolvedValue({
      total: { totalCost: 1.5, totalTokens: 1000, observationCount: 10 },
      chat: { totalCost: 0.5, totalTokens: 400, observationCount: 4 },
      critique: { totalCost: 1, totalTokens: 600, observationCount: 6 },
    });
  });

  it("returns 401 when session gate fails", async () => {
    mockRequireBillingBypassSession.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/llm-spend?userId=user-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when Langfuse is not configured", async () => {
    mockIsLangfuseEnabled.mockReturnValue(false);
    const res = await GET(
      new Request("http://localhost/api/admin/llm-spend?userId=user-1"),
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ configured: false });
  });

  it("returns 400 without userId or email", async () => {
    const res = await GET(new Request("http://localhost/api/admin/llm-spend"));
    expect(res.status).toBe(400);
  });

  it("returns spend for a userId", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/llm-spend?userId=user-1&days=30"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-1");
    expect(body.email).toBe("user@example.com");
    expect(body.configured).toBe(true);
    expect(body.total.totalCost).toBe(1.5);
    expect(body.chat.totalCost).toBe(0.5);
    expect(body.critique.totalCost).toBe(1);
    expect(mockEq).toHaveBeenCalledWith("id", "user-1");
    expect(mockFetchUserLlmSpend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("resolves email to a profile", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/admin/llm-spend?email=user@example.com&days=7",
      ),
    );
    expect(res.status).toBe(200);
    expect(mockIlike).toHaveBeenCalledWith("email", "user@example.com");
  });
});
