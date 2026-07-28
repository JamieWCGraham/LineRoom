import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSubscriptionForUser = vi.hoisted(() => vi.fn());
const mockSubscriptionIsPaid = vi.hoisted(() => vi.fn());
const mockUpsertSubscriptionFromStripe = vi.hoisted(() => vi.fn());
const mockGetStripe = vi.hoisted(() => vi.fn());
const mockCollectPaths = vi.hoisted(() => vi.fn());
const mockRemoveExplicit = vi.hoisted(() => vi.fn());
const mockRemoveAllUser = vi.hoisted(() => vi.fn());
const mockBillingLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/billing/subscription-row", () => ({
  fetchSubscriptionForUser: mockFetchSubscriptionForUser,
  subscriptionIsPaid: mockSubscriptionIsPaid,
}));

vi.mock("@/lib/billing/stripe-sync", () => ({
  upsertSubscriptionFromStripe: mockUpsertSubscriptionFromStripe,
}));

vi.mock("@/lib/billing/logger", () => ({
  billingLog: mockBillingLog,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/account/collectDraftRecordingPaths", () => ({
  collectDraftRecordingPathsFromUserSongs: mockCollectPaths,
}));

vi.mock("@/lib/draft-recordings/removeSongRecordings", () => ({
  removeExplicitRecordingPaths: mockRemoveExplicit,
  removeAllDraftRecordingsForUser: mockRemoveAllUser,
}));

import { deleteUserAndData } from "@/lib/account/deleteUserData";

describe("deleteUserAndData", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const mockDeleteUser = vi.fn();
  const mockUpdate = vi.fn();
  const admin = {
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  };

  const mockCancelSub = vi.fn();
  const mockDelCustomer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSubscriptionForUser.mockResolvedValue(null);
    mockSubscriptionIsPaid.mockReturnValue(false);
    mockCollectPaths.mockResolvedValue(["legacy/path.webm"]);
    mockRemoveExplicit.mockResolvedValue(undefined);
    mockRemoveAllUser.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue({ error: null });
    mockCancelSub.mockResolvedValue({ id: "sub_1" });
    mockDelCustomer.mockResolvedValue({ id: "cus_1", deleted: true });
    mockGetStripe.mockReturnValue({
      subscriptions: { cancel: mockCancelSub },
      customers: { del: mockDelCustomer },
    });
    mockUpsertSubscriptionFromStripe.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 409 when App Store subscription is active and not acknowledged", async () => {
    mockFetchSubscriptionForUser.mockResolvedValue({
      billing_provider: "app_store",
      status: "active",
      current_period_end: new Date(Date.now() + 86400000).toISOString(),
    });
    mockSubscriptionIsPaid.mockReturnValue(true);

    const result = await deleteUserAndData(admin as never, {
      userId,
      userEmail: "user@example.com",
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "active_app_store_subscription",
      error: "active_app_store_subscription",
      message: expect.stringContaining("App Store subscription"),
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("cancels Stripe, deletes customer, cleans storage, then deletes auth user", async () => {
    mockFetchSubscriptionForUser.mockResolvedValue({
      billing_provider: "stripe",
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
    });

    const result = await deleteUserAndData(admin as never, {
      userId,
      userEmail: "user@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(mockCancelSub).toHaveBeenCalledWith("sub_123");
    expect(mockUpsertSubscriptionFromStripe).toHaveBeenCalled();
    expect(mockDelCustomer).toHaveBeenCalledWith("cus_123");
    expect(mockCollectPaths).toHaveBeenCalledWith(admin, userId);
    expect(mockRemoveExplicit).toHaveBeenCalledWith(["legacy/path.webm"]);
    expect(mockRemoveAllUser).toHaveBeenCalledWith(userId);
    expect(mockDeleteUser).toHaveBeenCalledWith(userId);
  });

  it("still deletes user when Stripe cancel fails", async () => {
    mockFetchSubscriptionForUser.mockResolvedValue({
      billing_provider: "stripe",
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
    });
    mockCancelSub.mockRejectedValue(new Error("stripe down"));

    const result = await deleteUserAndData(admin as never, {
      userId,
      userEmail: "user@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(mockBillingLog.error).toHaveBeenCalledWith(
      "Stripe cancel before account delete failed",
      expect.objectContaining({ userId }),
    );
    expect(mockDeleteUser).toHaveBeenCalledWith(userId);
  });

  it("still deletes user when Stripe customer delete fails", async () => {
    mockFetchSubscriptionForUser.mockResolvedValue({
      billing_provider: "stripe",
      stripe_customer_id: "cus_123",
    });
    mockDelCustomer.mockRejectedValue(new Error("customer locked"));

    const result = await deleteUserAndData(admin as never, {
      userId,
      userEmail: "user@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(mockBillingLog.error).toHaveBeenCalledWith(
      "Stripe customer delete before account delete failed",
      expect.objectContaining({ userId, stripeCustomerId: "cus_123" }),
    );
    expect(mockDeleteUser).toHaveBeenCalledWith(userId);
  });

  it("returns 500 when auth delete fails", async () => {
    mockDeleteUser.mockResolvedValue({ error: { message: "auth error" } });

    const result = await deleteUserAndData(admin as never, {
      userId,
      userEmail: "user@example.com",
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "auth error",
    });
  });
});
