import { describe, expect, it, vi } from "vitest";
import {
  isValidShareToken,
  publishedLyricsUrl,
} from "@/lib/songs/publishedLyrics";

describe("publishedLyrics", () => {
  it("builds share URL from public app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lineroom.example");
    expect(publishedLyricsUrl("abc123def456ghi789")).toBe(
      "https://lineroom.example/p/abc123def456ghi789",
    );
    vi.unstubAllEnvs();
  });

  it("returns path-only URL when origin is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(publishedLyricsUrl("token123456789012")).toBe(
      "/p/token123456789012",
    );
    vi.unstubAllEnvs();
  });

  it("validates share token length", () => {
    expect(isValidShareToken("short")).toBe(false);
    expect(isValidShareToken("a".repeat(16))).toBe(true);
    expect(isValidShareToken("a".repeat(64))).toBe(true);
    expect(isValidShareToken("a".repeat(65))).toBe(false);
  });
});
