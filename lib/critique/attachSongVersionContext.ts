import type { CritiqueResult } from "@/lib/types";
import type { z } from "zod";
import { critiqueResultSchema } from "@/lib/validators";

type CritiqueParsed = z.infer<typeof critiqueResultSchema>;

export function attachSongVersionContext(
  critique: CritiqueParsed,
  payload: {
    analyzedSongVersion?: number;
    priorSongVersionCompared?: number | null;
    regenerate?: boolean;
  },
): CritiqueResult {
  const out = { ...critique };
  if (typeof payload.analyzedSongVersion === "number") {
    out.analyzedSongVersion = payload.analyzedSongVersion;
  } else {
    delete out.analyzedSongVersion;
    delete out.priorSongVersionCompared;
    delete out.comparedToSummary;
    return out;
  }

  if (payload.priorSongVersionCompared !== undefined) {
    out.priorSongVersionCompared = payload.priorSongVersionCompared;
  }

  if (payload.priorSongVersionCompared != null) {
    out.comparedToSummary = `Full saved lyrics draft and critique from version ${payload.priorSongVersionCompared} were included for comparison.`;
  } else if (payload.regenerate) {
    out.comparedToSummary = `Compared to the previous critique and the saved lyrics draft for version ${payload.analyzedSongVersion} from when this page was loaded (before your latest edits).`;
  } else {
    delete out.comparedToSummary;
  }

  return out;
}
