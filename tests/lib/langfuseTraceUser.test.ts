import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { buildLangfuseTraceUser } from "@/lib/langfuse/traceUser";

describe("buildLangfuseTraceUser", () => {
  it("prefers profile fields over auth metadata", () => {
    const user = {
      id: "user-1",
      email: "auth@example.com",
      app_metadata: {},
      user_metadata: { full_name: "Auth Name" },
    } as User;

    expect(
      buildLangfuseTraceUser(user, {
        email: "profile@example.com",
        display_name: "Profile Name",
      }),
    ).toEqual({
      userId: "user-1",
      email: "profile@example.com",
      displayName: "Profile Name",
    });
  });

  it("falls back to normalized auth profile", () => {
    const user = {
      id: "user-2",
      email: "auth@example.com",
      app_metadata: {},
      user_metadata: { full_name: "Auth Name" },
    } as User;

    expect(buildLangfuseTraceUser(user, null)).toEqual({
      userId: "user-2",
      email: "auth@example.com",
      displayName: "Auth Name",
    });
  });
});
