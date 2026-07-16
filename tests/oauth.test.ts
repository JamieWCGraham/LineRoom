import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OAUTH_NEXT_COOKIE,
  buildOAuthSignInOptions,
  oauthCallbackUrl,
  oauthStartHref,
  parseOAuthProvider,
  sanitizeAuthNext,
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

  it("exposes a stable cookie name for post-OAuth redirect", () => {
    expect(OAUTH_NEXT_COOKIE).toBe("lr_oauth_next");
  });

  it("builds Google sign-in with provider google", () => {
    const o = buildOAuthSignInOptions("google");
    expect(o.provider).toBe("google");
  });

  it("builds Apple sign-in with provider apple", () => {
    const o = buildOAuthSignInOptions("apple");
    expect(o.provider).toBe("apple");
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

  it("parses allowed providers only", () => {
    expect(parseOAuthProvider("google")).toBe("google");
    expect(parseOAuthProvider("apple")).toBe("apple");
    expect(parseOAuthProvider("github")).toBeNull();
    expect(parseOAuthProvider(null)).toBeNull();
  });

  it("sanitizes next paths", () => {
    expect(sanitizeAuthNext("/song/abc")).toBe("/song/abc");
    expect(sanitizeAuthNext("//evil.com")).toBe("/");
    expect(sanitizeAuthNext("https://evil.com")).toBe("/");
    expect(sanitizeAuthNext("")).toBe("/");
  });

  it("builds relative OAuth start URLs", () => {
    expect(oauthStartHref("google", "/")).toBe("/auth/oauth?provider=google");
    expect(oauthStartHref("apple", "/account")).toBe(
      "/auth/oauth?provider=apple&next=%2Faccount",
    );
  });
});

describe("OAuth UI feature flags", () => {
  const originalGoogle = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
  const originalApple = process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;

  afterEach(() => {
    if (originalGoogle === undefined) {
      delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = originalGoogle;
    }
    if (originalApple === undefined) {
      delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = originalApple;
    }
    vi.resetModules();
  });

  it("enables Google UI when NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=true", async () => {
    process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    vi.resetModules();
    const mod = await import("@/lib/auth/oauth");
    expect(mod.oauthGoogleEnabled).toBe(true);
    expect(mod.oauthAppleEnabled).toBe(false);
    expect(mod.oauthSignInUiEnabled).toBe(true);
  });

  it("keeps OAuth UI off when Google flag is unset", async () => {
    delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    vi.resetModules();
    const mod = await import("@/lib/auth/oauth");
    expect(mod.oauthGoogleEnabled).toBe(false);
    expect(mod.oauthSignInUiEnabled).toBe(false);
  });
});
