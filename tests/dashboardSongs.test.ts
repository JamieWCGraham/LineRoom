import { describe, expect, it } from "vitest";
import {
  getMomentum,
  parseCommaSeparatedGenres,
  parseOverallRatingBand,
} from "@/lib/songs/dashboardSongs";

describe("parseOverallRatingBand", () => {
  it("reads overallRatingBand from critique object", () => {
    expect(
      parseOverallRatingBand({ overallRatingBand: "Strong" }),
    ).toBe("Strong");
  });

  it("returns null for empty or invalid values", () => {
    expect(parseOverallRatingBand(null)).toBeNull();
    expect(parseOverallRatingBand({ overallRatingBand: "  " })).toBeNull();
  });
});

describe("parseCommaSeparatedGenres", () => {
  it("splits and trims genre string", () => {
    expect(parseCommaSeparatedGenres("Pop,  Rock ,,")).toEqual(["Pop", "Rock"]);
  });
});

describe("getMomentum", () => {
  it("returns up tone when latest band improves", () => {
    const result = getMomentum("Strong", "Promising", "2026-06-01T12:00:00Z");
    expect(result.tone).toBe("up");
    expect(result.label).toContain("▲");
    expect(result.label).toContain("Promising");
  });

  it("returns null when bands are missing", () => {
    expect(getMomentum(null, "Strong", "2026-06-01T12:00:00Z")).toEqual({
      label: null,
      tone: null,
    });
  });
});
