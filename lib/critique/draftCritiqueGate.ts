import type { SupabaseClient } from "@supabase/supabase-js";

import {
  draftFingerprint,
  shouldSkipDraftCritiqueGate,
} from "@/lib/draftFingerprint";
import {
  isDraftCritiqueGateEnabled,
  isDraftGateFailOpen,
} from "@/lib/critique/draftCritiqueGateConfig";
import type { CritiqueResult } from "@/lib/types";
import {
  lyricSubscoresSchema,
  overallRatingBandSchema,
} from "@/lib/validators";
import { z } from "zod";

export type DraftCritiqueGateHit = {
  overallRatingBand: CritiqueResult["overallRatingBand"];
  subscores: CritiqueResult["subscores"];
};

export type DraftCritiqueGateContext =
  | { kind: "off" }
  | { kind: "miss" }
  | {
      kind: "hit";
      canonical: DraftCritiqueGateHit;
      fingerprintPrefix: string;
    };

const registryRpcHitSchema = z.object({
  overall_rating_band: overallRatingBandSchema,
  subscores: lyricSubscoresSchema,
});

export type LookupDraftCritiqueRegistryResult =
  | { kind: "hit"; canonical: DraftCritiqueGateHit; fingerprintPrefix: string }
  | { kind: "miss" };

function toCanonicalHit(
  row: z.infer<typeof registryRpcHitSchema>,
): DraftCritiqueGateHit {
  return {
    overallRatingBand: row.overall_rating_band,
    subscores: row.subscores,
  };
}

export function toGateContext(
  lookup: LookupDraftCritiqueRegistryResult,
  enabled: boolean,
): DraftCritiqueGateContext {
  if (!enabled) return { kind: "off" };
  if (lookup.kind === "hit") {
    return {
      kind: "hit",
      canonical: lookup.canonical,
      fingerprintPrefix: lookup.fingerprintPrefix,
    };
  }
  return { kind: "miss" };
}

export async function lookupDraftCritiqueRegistry(
  supabase: SupabaseClient,
  fullText: string,
): Promise<LookupDraftCritiqueRegistryResult> {
  if (!isDraftCritiqueGateEnabled() || shouldSkipDraftCritiqueGate(fullText)) {
    return { kind: "miss" };
  }

  const fingerprint = draftFingerprint(fullText);
  const fingerprintPrefix = fingerprint.slice(0, 8);

  try {
    const { data, error } = await supabase.rpc(
      "resolve_lyric_draft_critique_registry",
      { p_fingerprint: fingerprint },
    );

    if (error) {
      console.error(
        "[draftCritiqueGate] resolve",
        fingerprintPrefix,
        error.message,
      );
      if (isDraftGateFailOpen()) return { kind: "miss" };
      throw error;
    }

    if (data == null) return { kind: "miss" };

    const parsed = registryRpcHitSchema.safeParse(data);
    if (!parsed.success) {
      console.error(
        "[draftCritiqueGate] invalid registry row",
        fingerprintPrefix,
        parsed.error.flatten(),
      );
      if (isDraftGateFailOpen()) return { kind: "miss" };
      throw new Error("Invalid lyric_draft_critique_registry row shape");
    }

    return {
      kind: "hit",
      canonical: toCanonicalHit(parsed.data),
      fingerprintPrefix,
    };
  } catch (e) {
    if (!isDraftGateFailOpen()) throw e;
    console.error("[draftCritiqueGate] lookup degraded", fingerprintPrefix, e);
    return { kind: "miss" };
  }
}

export async function registerDraftCritiqueRegistry(
  supabase: SupabaseClient,
  fullText: string,
  critique: Pick<CritiqueResult, "overallRatingBand" | "subscores">,
  sourceSongVersionId?: string | null,
): Promise<void> {
  if (!isDraftCritiqueGateEnabled() || shouldSkipDraftCritiqueGate(fullText)) {
    return;
  }

  const fingerprint = draftFingerprint(fullText);

  const { error } = await supabase.rpc(
    "register_lyric_draft_critique_registry",
    {
      p_fingerprint: fingerprint,
      p_overall_rating_band: critique.overallRatingBand,
      p_subscores: critique.subscores,
      p_source_song_version_id: sourceSongVersionId ?? null,
    },
  );

  if (error) {
    console.error(
      "[draftCritiqueGate] register",
      fingerprint.slice(0, 8),
      error.message,
    );
  }
}
