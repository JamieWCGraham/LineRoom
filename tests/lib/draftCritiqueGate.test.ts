import { describe, expect, it, vi } from "vitest";

import {
  lookupDraftCritiqueRegistry,
  registerDraftCritiqueRegistry,
  toGateContext,
} from "@/lib/critique/draftCritiqueGate";

describe("draftCritiqueGate", () => {
  it("toGateContext maps hit when enabled", () => {
    const canonical = {
      overallRatingBand: "Strong" as const,
      subscores: {
        emotional_impact: 4 as const,
        imagery_specificity: 3 as const,
        originality_voice: 4 as const,
        prosody_singability: 4 as const,
        structure_cohesion: 3 as const,
        lyrical_economy: 4 as const,
        hook_strength: 3 as const,
      },
    };
    const ctx = toGateContext(
      { kind: "hit", canonical, fingerprintPrefix: "abcd1234" },
      true,
    );
    expect(ctx).toEqual({
      kind: "hit",
      canonical,
      fingerprintPrefix: "abcd1234",
    });
  });

  it("lookup returns hit from resolve RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        overall_rating_band: "Promising",
        subscores: {
          emotional_impact: 3,
          imagery_specificity: 3,
          originality_voice: 3,
          prosody_singability: 3,
          structure_cohesion: 3,
          lyrical_economy: 3,
          hook_strength: 3,
        },
      },
      error: null,
    });
    const supabase = { rpc } as unknown as Parameters<
      typeof lookupDraftCritiqueRegistry
    >[0];

    const result = await lookupDraftCritiqueRegistry(
      supabase,
      "line one ".repeat(20),
    );
    expect(result.kind).toBe("hit");
    if (result.kind === "hit") {
      expect(result.canonical.overallRatingBand).toBe("Promising");
    }
    expect(rpc).toHaveBeenCalledWith(
      "resolve_lyric_draft_critique_registry",
      expect.objectContaining({
        p_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("lookup fail-open on RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    });
    const supabase = { rpc } as unknown as Parameters<
      typeof lookupDraftCritiqueRegistry
    >[0];

    const result = await lookupDraftCritiqueRegistry(
      supabase,
      "line one ".repeat(20),
    );
    expect(result).toEqual({ kind: "miss" });
  });

  it("register calls RPC with band and subscores", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const supabase = { rpc } as unknown as Parameters<
      typeof registerDraftCritiqueRegistry
    >[0];

    await registerDraftCritiqueRegistry(supabase, "line one ".repeat(20), {
      overallRatingBand: "Strong",
      subscores: {
        emotional_impact: 4,
        imagery_specificity: 4,
        originality_voice: 4,
        prosody_singability: 4,
        structure_cohesion: 4,
        lyrical_economy: 4,
        hook_strength: 4,
      },
    });

    expect(rpc).toHaveBeenCalledWith(
      "register_lyric_draft_critique_registry",
      expect.objectContaining({
        p_overall_rating_band: "Strong",
        p_source_song_version_id: null,
      }),
    );
  });
});
