import { runWithLangfuseTrace } from "@/lib/langfuse-server";
import {
  getCritiqueNetworkRetryDelayMs,
  isRetriableOpenAICritiqueError,
  rethrowIfBadRequest,
  sleepMs,
} from "@/lib/critique/critiqueNetworkRetry";
import { attachSongVersionContext } from "@/lib/critique/attachSongVersionContext";
import { sanitizeForOpenAI } from "@/lib/critique/sanitizeForOpenAI";
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

export type RunCritiqueModelLegacyOptions = {
  traceTags?: string[];
  rootObservationName?: string;
  generationName?: string;
};

/**
 * Single-call monolithic critique (legacy rollout path).
 */
export async function runCritiqueModelLegacy(
  payload: CritiqueRequestPayload,
  options?: RunCritiqueModelLegacyOptions,
): Promise<{ critique: CritiqueResult; userContent: string }> {
  const userContent = sanitizeForOpenAI(buildCritiqueUserPayload(payload));
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

      const completeOnce = async (
        repairHint?: string,
      ): Promise<CritiqueResult> => {
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CRITIQUE_JSON_INSTRUCTIONS },
            ...(repairHint ? [{ role: "system" as const, content: repairHint }] : []),
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
          console.error(
            "[runCritiqueModelLegacy] __BAD_SHAPE__ validation errors:",
            JSON.stringify(validated.error.flatten(), null, 2),
          );
          throw new Error("__BAD_SHAPE__");
        }

        return attachSongVersionContext(validated.data, payload);
      };

      let c: CritiqueResult;
      try {
        c = await completeOnce();
      } catch (first) {
        rethrowIfBadRequest(first);

        const firstMessage =
          first instanceof Error ? first.message : "Unknown error";

        if (isRetriableOpenAICritiqueError(first)) {
          await sleepMs(getCritiqueNetworkRetryDelayMs());
          c = await completeOnce();
          setTraceIO({
            input: { messages: payload },
            output: c,
          });
          return c;
        }

        if (
          firstMessage === "__EMPTY_MODEL__" ||
          firstMessage === "__BAD_JSON__" ||
          firstMessage === "__BAD_SHAPE__"
        ) {
          c = await completeOnce(
            [
              "Your prior answer was invalid.",
              "Return ONLY one valid JSON object that strictly matches the required schema.",
              "Do not include markdown, code fences, or commentary.",
              "Ensure every required key is present with correct types.",
            ].join(" "),
          );
        } else {
          throw first;
        }
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
