import { describe, expect, it, vi } from "vitest";
import {
  buildIosSubscriptionDisplay,
  formatIso8601BillingPeriod,
} from "@/lib/billing/ios-subscription-disclosure";
import {
  APPLE_STANDARD_EULA_URL,
  getPrivacyPolicyUrl,
  getTermsOfUseUrl,
} from "@/lib/legal/urls";

describe("formatIso8601BillingPeriod", () => {
  it("formats month and year durations", () => {
    expect(formatIso8601BillingPeriod("P1M")).toBe("1 month");
    expect(formatIso8601BillingPeriod("P1Y")).toBe("1 year");
    expect(formatIso8601BillingPeriod("P3M")).toBe("3 months");
  });

  it("returns null for invalid input", () => {
    expect(formatIso8601BillingPeriod(undefined)).toBeNull();
    expect(formatIso8601BillingPeriod("not-a-duration")).toBeNull();
  });
});

describe("buildIosSubscriptionDisplay", () => {
  it("surfaces recurring billed price over free trial", () => {
    const display = buildIosSubscriptionDisplay(
      { title: "LineRoom Pro Monthly", description: "Unlimited critiques." },
      {
        pricingPhases: [
          {
            price: "$0.00",
            billingPeriod: "P1W",
            paymentMode: "FreeTrial",
          },
          {
            price: "$4.99",
            billingPeriod: "P1M",
            paymentMode: "PayAsYouGo",
            recurrenceMode: "INFINITE_RECURRING",
          },
        ],
      },
    );
    expect(display.title).toBe("LineRoom Pro Monthly");
    expect(display.billedPrice).toBe("$4.99");
    expect(display.periodLabel).toBe("1 month");
    expect(display.subordinateLines).toContain("Free trial: 1 week");
  });

  it("uses defaults when store metadata is missing", () => {
    const display = buildIosSubscriptionDisplay(
      { title: "", description: "" },
      { pricingPhases: [] },
    );
    expect(display.title).toBe("LineRoom Pro");
    expect(display.billedPrice).toBe("—");
    expect(display.serviceDescription).toMatch(/Unlimited AI-powered/);
  });
});

describe("legal URLs", () => {
  it("EULA points to Apple standard; privacy uses app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lineroom.example");
    expect(getTermsOfUseUrl()).toBe(APPLE_STANDARD_EULA_URL);
    expect(getPrivacyPolicyUrl()).toBe("https://lineroom.example/privacy");
    vi.unstubAllEnvs();
  });
});
