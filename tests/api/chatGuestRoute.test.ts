import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetAuthUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/langfuse-server", () => ({
  runWithLangfuseTrace: vi.fn(async (_opts: unknown, fn: () => Promise<unknown>) => fn()),
  scheduleLangfuseFlush: vi.fn(),
}));

vi.mock("@/lib/openai", () => ({
  createBaseOpenAI: vi.fn(),
  getFastChatModel: vi.fn(() => "gpt-test"),
}));

import { POST } from "@/app/api/chat/route";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "hello",
          pieceTitle: "t",
          messages: [],
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when anonymous guest tries workshop", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "guest-1",
      is_anonymous: true,
    } as User);
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "hello",
          pieceTitle: "t",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: string;
      signupRequired?: boolean;
    };
    expect(body.signupRequired).toBe(true);
    expect(body.error).toMatch(/signed-up users/i);
  });
});
