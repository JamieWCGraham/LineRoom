import { describe, expect, it, vi } from "vitest";
import {
  APPLE_STANDARD_EULA_URL,
  getPrivacyPolicyUrl,
  getServiceTermsUrl,
  getTermsOfUseEulaUrl,
  getTermsOfUseUrl,
} from "@/lib/legal/urls";

describe("legal URLs", () => {
  it("uses Apple standard EULA for Terms of Use", () => {
    expect(getTermsOfUseEulaUrl()).toBe(APPLE_STANDARD_EULA_URL);
    expect(getTermsOfUseUrl()).toBe(APPLE_STANDARD_EULA_URL);
    expect(APPLE_STANDARD_EULA_URL).toContain("stdeula");
  });

  it("builds service terms and privacy from public app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lineroom.example");
    expect(getServiceTermsUrl()).toBe("https://lineroom.example/terms");
    expect(getPrivacyPolicyUrl()).toBe("https://lineroom.example/privacy");
    vi.unstubAllEnvs();
  });
});
