import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetAuthUser = vi.hoisted(() => vi.fn());
const mockRunWithLangfuseTrace = vi.hoisted(() =>
  vi.fn(async (_opts: unknown, fn: (ctx: unknown) => Promise<unknown>) =>
    fn({
      createTracedOpenAI: (client: unknown) => client,
      setTraceIO: vi.fn(),
    }),
  ),
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/langfuse-server", () => ({
  runWithLangfuseTrace: mockRunWithLangfuseTrace,
  scheduleLangfuseFlush: vi.fn(),
}));

vi.mock("@/lib/openai", () => ({
  createBaseOpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: "hello back" } }],
        })),
      },
    },
  })),
  getFastChatModel: vi.fn(() => "gpt-test"),
}));

import { POST } from "@/app/api/chat/route";

describe("POST /api/chat", () => {
  const mockMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { display_name: "Jamie", email: "jamie@example.com" },
      error: null,
    });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
    });
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

  it("passes Langfuse traceUser for signed-in chat", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "user-1",
      email: "jamie@example.com",
      is_anonymous: false,
      app_metadata: {},
      user_metadata: { full_name: "Jamie" },
    } as User);

    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: "hello lyrics",
          pieceTitle: "Song",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRunWithLangfuseTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ["lineroom", "chat"],
        traceUser: expect.objectContaining({
          userId: "user-1",
          email: "jamie@example.com",
          displayName: "Jamie",
        }),
      }),
      expect.any(Function),
    );
  });
});
