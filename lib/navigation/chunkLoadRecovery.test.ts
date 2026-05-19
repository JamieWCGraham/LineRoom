import { describe, expect, it } from "vitest";
import { isChunkLoadFailure } from "./chunkLoadRecovery";

describe("isChunkLoadFailure", () => {
  it("detects webpack stale chunk TypeError", () => {
    const err = new TypeError(
      "Cannot read properties of undefined (reading 'call')",
    );
    err.stack =
      "TypeError: Cannot read properties of undefined (reading 'call')\n" +
      "    at r (https://app.example/_next/static/chunks/webpack-780d77dd.js:1:128)";
    expect(isChunkLoadFailure(err)).toBe(true);
  });

  it("detects classic chunk load messages", () => {
    expect(isChunkLoadFailure(new Error("Loading chunk 123 failed"))).toBe(
      true,
    );
    expect(
      isChunkLoadFailure(
        new Error("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadFailure(new Error("Network request failed"))).toBe(
      false,
    );
  });
});
