import { describe, expect, it, afterEach, vi } from "vitest";
import { hasEvalsAccess } from "@/lib/evals/access";

describe("evals access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to jgraham0@msn.com when env unset", () => {
    vi.stubEnv("EVALS_ACCESS_EMAILS", "");
    expect(hasEvalsAccess("jgraham0@msn.com")).toBe(true);
    expect(hasEvalsAccess("other@example.com")).toBe(false);
  });

  it("respects EVALS_ACCESS_EMAILS case-insensitively", () => {
    vi.stubEnv("EVALS_ACCESS_EMAILS", "A@x.com, B@y.com ");
    expect(hasEvalsAccess("a@x.com")).toBe(true);
    expect(hasEvalsAccess("jgraham0@msn.com")).toBe(false);
  });
});
