import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  escapeCsvField,
  genreToDbColumn,
  parseCsv,
  parseEvalSongCsv,
  rowsToCsv,
} from "@/lib/evals/evalSongInput";
import { extendEvalSetWithLyrics } from "@/lib/evals/extendEvalSetPipeline";
import {
  fetchSongLyrics,
  normalizeArtistForSearch,
  titleVariants,
} from "@/lib/evals/fetchSongLyrics";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted commas and newlines", () => {
    const grid = parseCsv('a,"b,c"\n"d""e","f\ng"');
    expect(grid).toEqual([
      ["a", "b,c"],
      ['d"e', "f\ng"],
    ]);
  });

  it("throws on unterminated quote", () => {
    expect(() => parseCsv('"abc')).toThrow(/Unterminated/);
  });
});

describe("parseEvalSongCsv", () => {
  it("maps headers and trims rows", () => {
    const csv = [
      "title,artist,genre,overall_score,rationale_short",
      "  My Song , A & B , pop , Strong , note here ",
    ].join("\n");
    const rows = parseEvalSongCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      title: "My Song",
      artist: "A & B",
      genre: "pop",
      overall_score: "Strong",
      rationale_short: "note here",
    });
  });

  it("rejects missing headers", () => {
    expect(() => parseEvalSongCsv("title,artist\nx,y")).toThrow(/overall_score/);
  });
});

describe("genreToDbColumn", () => {
  it("defaults empty to pop", () => {
    expect(JSON.parse(genreToDbColumn(""))).toEqual(["pop"]);
  });

  it("splits comma tags", () => {
    expect(JSON.parse(genreToDbColumn("Indie, Folk"))).toEqual(["Indie", "Folk"]);
  });

  it("accepts JSON array strings", () => {
    expect(JSON.parse(genreToDbColumn('["a","b"]'))).toEqual(["a", "b"]);
  });
});

describe("rowsToCsv / escapeCsvField", () => {
  it("escapes special characters", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
  });

  it("builds a document", () => {
    const doc = rowsToCsv(["x", "y"], [
      ["1", "2"],
      ["a,b", "c"],
    ]);
    expect(doc).toBe('x,y\r\n1,2\r\n"a,b",c');
  });
});

describe("fetchSongLyrics", () => {
  it("returns lyrics.ovh result when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lyrics: "  line one  " }),
    });
    const lyrics = await fetchSongLyrics("T", "A", fetchImpl as unknown as typeof fetch);
    expect(lyrics).toBe("line one");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to LRCLIB when lyrics.ovh misses", async () => {
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            plainLyrics: "from lrclib",
            artistName: "A",
            trackName: "T",
          },
        ],
      });
    const lyrics = await fetchSongLyrics("T", "A", fetchImpl as unknown as typeof fetch);
    expect(lyrics).toBe("from lrclib");
    expect(fetchImpl).toHaveBeenCalled();
    const secondUrl = String(fetchImpl.mock.calls[1]?.[0]);
    expect(secondUrl).toContain("lrclib.net/api/search");
  });
});

describe("normalizeArtistForSearch / titleVariants", () => {
  it("strips featured-artist phrasing", () => {
    expect(normalizeArtistForSearch("X feat. Y")).toBe("X Y");
  });

  it("produces title variants", () => {
    const v = titleVariants("Song (live)");
    expect(v.length).toBeGreaterThan(1);
    expect(v).toContain("Song");
    expect(v.some((t) => !t.includes("("))).toBe(true);
  });
});

describe("extendEvalSetWithLyrics", () => {
  it("inserts when lyrics resolve", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 42 }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const admin = { from } as unknown as SupabaseClient;

    const results = await extendEvalSetWithLyrics(
      admin,
      [
        {
          title: "T",
          artist: "A",
          genre: "pop",
          overall_score: "Strong",
          rationale_short: "r",
        },
      ],
      {
        fetchLyrics: async () => "lyrics body",
      },
    );

    expect(results).toEqual([
      { status: "inserted", title: "T", artist: "A", id: 42 },
    ]);
    expect(insert).toHaveBeenCalledWith({
      title: "T",
      artist: "A",
      lyrics: "lyrics body",
      genre: JSON.stringify(["pop"]),
      overall_score: "Strong",
      rationale_short: "r",
    });
  });

  it("records failure when lyrics missing", async () => {
    const from = vi.fn();
    const admin = { from } as unknown as SupabaseClient;

    const results = await extendEvalSetWithLyrics(
      admin,
      [
        {
          title: "T",
          artist: "A",
          genre: "pop",
          overall_score: "Strong",
          rationale_short: "",
        },
      ],
      { fetchLyrics: async () => null },
    );

    expect(results[0]?.status).toBe("failed");
    expect(from).not.toHaveBeenCalled();
  });
});
