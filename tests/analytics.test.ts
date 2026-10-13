import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsProps } from "@/lib/analytics";

describe("sanitizeAnalyticsProps", () => {
  it("keeps non-PII plan and source", () => {
    expect(
      sanitizeAnalyticsProps({ plan: "pro", source: "pricing_page" }),
    ).toEqual({ plan: "pro", source: "pricing_page" });
  });

  it("drops emails, lyrics, and user ids", () => {
    expect(
      sanitizeAnalyticsProps({
        plan: "free",
        email: "person@example.com",
        lyrics: "neon rain",
        userId: "abc",
        note: "writer@example.com",
      }),
    ).toEqual({ plan: "free" });
  });
});
