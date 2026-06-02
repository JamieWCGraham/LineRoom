import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getFreeCritiqueQuota,
  isBillingBypassed,
} from "@/lib/billing/config";

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

  it("detects bypass emails case-insensitively", () => {
    vi.stubEnv("BILLING_BYPASS_EMAILS", "A@x.com, B@y.com ");
    expect(isBillingBypassed("a@x.com")).toBe(true);
    expect(isBillingBypassed("c@z.com")).toBe(false);
  });
});
