import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateServiceRoleClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/draft-recordings/bucket", () => ({
  getDraftRecordingsBucket: () => "draft-recordings",
}));

import { removeAllDraftRecordingsForUser } from "@/lib/draft-recordings/removeSongRecordings";

describe("removeAllDraftRecordingsForUser", () => {
  const mockRemove = vi.fn();
  const mockList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRemove.mockResolvedValue({ error: null });
    mockList.mockResolvedValue({
      data: [
        { name: "song-a" },
        { name: "memo.webm" },
      ],
      error: null,
    });
    mockCreateServiceRoleClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          list: mockList,
          remove: mockRemove,
        })),
      },
    });
  });

  it("lists under user prefix and removes collected audio paths", async () => {
    const userId = "user-1";
    mockList
      .mockResolvedValueOnce({
        data: [{ name: "song-a" }, { name: "memo.webm" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ name: "take.webm" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await removeAllDraftRecordingsForUser(userId);

    expect(mockList).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockRemove).toHaveBeenCalledWith([
      `${userId}/song-a/take.webm`,
      `${userId}/memo.webm`,
    ]);
  });

  it("no-ops when user id is empty", async () => {
    await removeAllDraftRecordingsForUser("  ");
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
  });
});
