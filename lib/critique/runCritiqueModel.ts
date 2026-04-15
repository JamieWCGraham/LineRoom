import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import {
  getCritiqueNetworkRetryDelayMs,
  isRetriableOpenAICritiqueError,
  sleepMs,
} from "@/lib/critique/critiqueNetworkRetry";
import { createBaseOpenAI, getChatModel } from "@/lib/openai";
import {
  buildCritiqueUserPayload,
  CRITIQUE_JSON_INSTRUCTIONS,
} from "@/lib/prompts";
import type { CritiqueResult } from "@/lib/types";
import {
  critiqueRequestSchema,
  critiqueResultSchema,
} from "@/lib/validators";
import type { z } from "zod";

type CritiqueRequestPayload = z.infer<typeof critiqueRequestSchema>;

function attachSongVersionContext(
  critique: z.infer<typeof critiqueResultSchema>,
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

export type RunCritiqueModelOptions = {
  /** Langfuse / trace labels (default: production critique). */
  traceTags?: string[];
  rootObservationName?: string;
  generationName?: string;
};

/**
 * Runs the lyric critique LLM call (same path as POST /api/critique).
 */
export async function runCritiqueModel(
  payload: CritiqueRequestPayload,
  options?: RunCritiqueModelOptions,
): Promise<{ critique: CritiqueResult; userContent: string }> {
  scheduleLangfuseFlush();
  const userContent = buildCritiqueUserPayload(payload);
  const tags = options?.traceTags ?? ["lineroom", "critique"];
  const rootObservationName =
    options?.rootObservationName ?? "lineroom-critique";
  const generationName = options?.generationName ?? "lyric-critique";

  const critique = await runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName,
      tags,
      langfuseConfig: {
        traceName: "LineRoom",
        generationName,
        tags,
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const openai = createTracedOpenAI(createBaseOpenAI());

      const completeOnce = async (): Promise<CritiqueResult> => {
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CRITIQUE_JSON_INSTRUCTIONS },
            { role: "user", content: userContent },
          ],
        });

        const raw = completion.choices[0]?.message?.content?.trim();
        if (!raw) {
          throw new Error("__EMPTY_MODEL__");
        }

        let json: unknown;
        try {
          json = JSON.parse(raw) as unknown;
        } catch {
          throw new Error("__BAD_JSON__");
        }

        const validated = critiqueResultSchema.safeParse(json);
        if (!validated.success) {
          throw new Error("__BAD_SHAPE__");
        }

        return attachSongVersionContext(validated.data, payload);
      };

      let c: CritiqueResult;
      try {
        c = await completeOnce();
      } catch (first) {
        if (!isRetriableOpenAICritiqueError(first)) {
          throw first;
        }
        await sleepMs(getCritiqueNetworkRetryDelayMs());
        c = await completeOnce();
      }

      setTraceIO({
        input: { messages: payload },
        output: c,
      });
      return c;
    },
  );

  return { critique, userContent };
}
