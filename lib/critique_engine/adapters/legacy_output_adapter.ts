import type { CritiqueResult } from "@/lib/types";

/**
 * Multi-node merge already emits `CritiqueResult` for the LineRoom UI.
 * This adapter exists for explicit compatibility boundaries if the engine
 * shape diverges in the future.
 */
export function toUiCritiqueResult(result: CritiqueResult): CritiqueResult {
  return result;
}
