import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAutosavePayloadString,
  buildSongDocumentPayload,
  chainPersist,
  scheduleDebouncedFlush,
  shouldAbortAfterPersist,
  shouldEnqueueFlush,
  shouldSkipPersist,
} from "@/lib/songs/persist";
import { saveSongVersionPayloadSchema } from "@/lib/validators";

describe("buildAutosavePayload", () => {
  it("serializes payload valid against saveSongVersionPayloadSchema", () => {
    const payload = buildSongDocumentPayload({
      draftText: "hello",
      brainstormText: "notes",
      chatMessages: [{ role: "user", content: "hi" }],
      critique: null,
      meta: { title: "T", similarArtists: "", genre: "" },
    });
    const parsed = saveSongVersionPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    const json = buildAutosavePayloadString({
      draftText: "hello",
      brainstormText: "notes",
      chatMessages: [{ role: "user", content: "hi" }],
      critique: null,
      meta: { title: "T", similarArtists: "", genre: "" },
    });
    expect(JSON.parse(json)).toEqual(payload);
  });
});

describe("persistQueue guards", () => {
  const baseRefs = {
    versionRowPersistLock: false,
    persistPaused: false,
    activeVersionId: "v1",
    lastPersistedPayload: "{}",
    latestPayload: '{"draft_text":"x"}',
  };

  it("skips when locked", () => {
    expect(
      shouldSkipPersist(
        { ...baseRefs, versionRowPersistLock: true },
        "v1",
      ),
    ).toBe("locked");
  });

  it("skips when version switched", () => {
    expect(shouldSkipPersist(baseRefs, "v2")).toBe("version switched");
  });

  it("aborts after persist when version changed", () => {
    expect(
      shouldAbortAfterPersist(
        { ...baseRefs, activeVersionId: "v2" },
        "v1",
      ),
    ).toBe(true);
  });

  it("does not enqueue when payload unchanged", () => {
    expect(
      shouldEnqueueFlush({
        ...baseRefs,
        latestPayload: "{}",
        lastPersistedPayload: "{}",
      }),
    ).toBe(false);
  });
});

describe("chainPersist", () => {
  it("runs tasks sequentially", async () => {
    const order: number[] = [];
    const chainRef = { current: Promise.resolve() };
    const p1 = chainPersist(chainRef, async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = chainPersist(chainRef, async () => {
      order.push(2);
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});

describe("scheduleDebouncedFlush", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces flush by default delay", () => {
    const timerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const flush = vi.fn();
    scheduleDebouncedFlush(timerRef, flush, 800);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(799);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
