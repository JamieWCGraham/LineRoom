import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createBaseOpenAI } from "@/lib/openai";
import { runMultinodeCritiqueEngine } from "@/lib/critique_engine/runMultinodeCritiqueEngine";
import { critiqueResultSchema } from "@/lib/validators";
import { isMultinodeCritiqueEngineEnabled } from "@/lib/critique_engine/config/critique_engine_config";
import { lineFeedbackAnnotationBounds } from "@/lib/critique_engine/schemas/line_feedback";
import { segmentLyrics } from "@/lib/critique_engine/utils/lyric_segmentation";

function loadDotEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnvLocal();

const LYRIC = `Verse 1
We left the city in a borrowed car
The radio static like a fading star
You said the truth is lighter than it seems
I held the wheel, you held onto dreams

Chorus
If we don't turn around, we turn into dust
Name every mile until the engine trusts
The night don't ask who we were before
It only asks what we're running for`;

const hasKey = () => Boolean(process.env.OPENAI_API_KEY?.trim());
const shouldRunE2E = () => hasKey() && isMultinodeCritiqueEngineEnabled();

describe("multinode critique engine (e2e)", () => {
  (shouldRunE2E() ? it : it.skip)(
    "runs genre-context → calibration-scoring → synthesis → line-level-feedback",
    async () => {
      const openai = createBaseOpenAI();
      const { critique, timings, userContent } = await runMultinodeCritiqueEngine(
        openai,
        {
          fullText: LYRIC,
          title: "Borrowed Car",
          similarArtists: "Jason Isbell, The War on Drugs",
          genre: "indie rock",
          mode: "deep",
        },
        { sessionId: `e2e-${Date.now()}` },
      );

      const parsed = critiqueResultSchema.safeParse(critique);
      expect(parsed.success, JSON.stringify(parsed.error?.flatten())).toBe(true);
      expect(critique.overallStrengths.length).toBeGreaterThanOrEqual(2);
      expect(critique.overallRatingBand).toBeTruthy();
      const minAnnotations = lineFeedbackAnnotationBounds(segmentLyrics(LYRIC)).min;
      expect(critique.lineFeedback.length).toBeGreaterThanOrEqual(minAnnotations);
      expect(timings["genre-context_ms"]).toBeTypeOf("number");
      expect(timings["calibration-scoring_ms"]).toBeTypeOf("number");
      expect(timings["synthesis_ms"]).toBeTypeOf("number");
      expect(timings["line-level-feedback_ms"]).toBeTypeOf("number");
      expect(userContent).toContain("multinode-critique");
    },
    180_000,
  );
});
