import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/billing/stripe-sync", () => ({
  upsertSubscriptionFromStripe: vi.fn(),
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    mockCreateServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing signature" });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bad" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(mockConstructEvent).toHaveBeenCalledWith(
      "{}",
      "t=1,v1=bad",
      "whsec_test",
    );
  });
});
