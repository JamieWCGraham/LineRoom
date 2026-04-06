import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildOAuthSignInOptions,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";

describe("OAuth helpers", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  it("builds Google sign-in with provider google", () => {
    const o = buildOAuthSignInOptions("google");
    expect(o.provider).toBe("google");
  });

  it("builds GitHub sign-in with provider github", () => {
    const o = buildOAuthSignInOptions("github");
    expect(o.provider).toBe("github");
  });

  it("uses NEXT_PUBLIC_SITE_URL for callback path", () => {
    expect(oauthCallbackUrl()).toBe(
      "https://app.example.com/auth/callback",
    );
    const g = buildOAuthSignInOptions("google");
    expect(g.options.redirectTo).toBe(
      "https://app.example.com/auth/callback",
    );
  });
});
