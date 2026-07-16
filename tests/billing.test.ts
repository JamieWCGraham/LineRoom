import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getFreeCritiqueQuota,
  getGuestCritiqueQuota,
  isBillingBypassed,
} from "@/lib/billing/config";
import { getCritiqueQuotaForUser } from "@/lib/billing/access";
import type { User } from "@supabase/supabase-js";

describe("billing config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses FREE_CRITIQUE_QUOTA", () => {
    vi.stubEnv("FREE_CRITIQUE_QUOTA", "12");
    expect(getFreeCritiqueQuota()).toBe(12);
  });

  it("defaults quota when invalid", () => {
    vi.stubEnv("FREE_CRITIQUE_QUOTA", "nope");
    expect(getFreeCritiqueQuota()).toBe(25);
  });

  it("parses GUEST_CRITIQUE_QUOTA", () => {
    vi.stubEnv("GUEST_CRITIQUE_QUOTA", "2");
    expect(getGuestCritiqueQuota()).toBe(2);
  });

  it("defaults guest quota when invalid", () => {
    vi.stubEnv("GUEST_CRITIQUE_QUOTA", "nope");
    expect(getGuestCritiqueQuota()).toBe(3);
  });

  it("detects bypass emails case-insensitively", () => {
    vi.stubEnv("BILLING_BYPASS_EMAILS", "A@x.com, B@y.com ");
    expect(isBillingBypassed("a@x.com")).toBe(true);
    expect(isBillingBypassed("c@z.com")).toBe(false);
  });

  it("getCritiqueQuotaForUser uses guest quota for anonymous users", () => {
    vi.stubEnv("GUEST_CRITIQUE_QUOTA", "3");
    vi.stubEnv("FREE_CRITIQUE_QUOTA", "25");
    const anon = { is_anonymous: true } as User;
    const registered = { is_anonymous: false } as User;
    expect(getCritiqueQuotaForUser(anon)).toBe(3);
    expect(getCritiqueQuotaForUser(registered)).toBe(25);
    expect(getCritiqueQuotaForUser(null)).toBe(25);
  });
});
