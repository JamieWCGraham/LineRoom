import { createHash } from "node:crypto";

import { MIN_NORMALIZED_DRAFT_LENGTH } from "@/lib/critique/draftCritiqueGateConfig";

/** Modulo line breaks and spaces: remove all Unicode whitespace. */
export function normalizeDraftForFingerprint(text: string): string {
  return text.replace(/\s+/gu, "");
}

export function draftFingerprint(text: string): string {
  const normalized = normalizeDraftForFingerprint(text);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function shouldSkipDraftCritiqueGate(fullText: string): boolean {
  return normalizeDraftForFingerprint(fullText).length < MIN_NORMALIZED_DRAFT_LENGTH;
}
