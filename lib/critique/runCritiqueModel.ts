import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import {
  getCritiqueNetworkRetryDelayMs,
  isRetriableOpenAICritiqueError,
  rethrowIfBadRequest,
  sleepMs,
} from "@/lib/critique/critiqueNetworkRetry";
import { runCritiqueModelLegacy } from "@/lib/critique/runCritiqueModelLegacy";
import { createBaseOpenAI } from "@/lib/openai";
import { isMultinodeCritiqueEngineEnabled } from "@/lib/critique_engine/config/critique_engine_config";
import { runMultinodeCritiqueEngine } from "@/lib/critique_engine/runMultinodeCritiqueEngine";
import type { CritiqueResult } from "@/lib/types";
import { critiqueRequestSchema } from "@/lib/validators";
import type { z } from "zod";

type CritiqueRequestPayload = z.infer<typeof critiqueRequestSchema>;

export type RunCritiqueModelOptions = {
  traceTags?: string[];
  rootObservationName?: string;
  generationName?: string;
  /** Enables `critique_engine_runs` inserts when env is configured. */
  userId?: string;
};

async function runMultinodeOnce(
  payload: CritiqueRequestPayload,
  options?: RunCritiqueModelOptions,
): Promise<{ critique: CritiqueResult; userContent: string }> {
  return runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName:
        options?.rootObservationName ?? "lineroom-critique",
      tags: options?.traceTags ?? ["lineroom", "critique"],
      langfuseConfig: {
        traceName: "LineRoom",
        tags: options?.traceTags ?? ["lineroom", "critique"],
        ...(options?.generationName ?
          { generationName: options.generationName }
        : {}),
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      void createTracedOpenAI;
      /** Untraced client: each LLM call is scoped under its own Langfuse step (`genre-context`, …) instead of duplicating one `generationName` on every completion. */
      const openai = createBaseOpenAI();
      const { critique, userContent } = await runMultinodeCritiqueEngine(
        openai,
        payload,
        { userId: options?.userId },
      );
      setTraceIO({ input: payload, output: critique });
      return { critique, userContent };
    },
  );
}

/**
 * Runs the lyric critique pipeline (multi-node by default; legacy single-call when
 * `USE_MULTINODE_CRITIQUE_ENGINE` is disabled).
 */
export async function runCritiqueModel(
  payload: CritiqueRequestPayload,
  options?: RunCritiqueModelOptions,
): Promise<{ critique: CritiqueResult; userContent: string }> {
  scheduleLangfuseFlush();

  if (!isMultinodeCritiqueEngineEnabled()) {
    return runCritiqueModelLegacy(payload, options);
  }

  try {
    return await runMultinodeOnce(payload, options);
  } catch (first) {
    rethrowIfBadRequest(first);
    if (isRetriableOpenAICritiqueError(first)) {
      await sleepMs(getCritiqueNetworkRetryDelayMs());
      return runMultinodeOnce(payload, options);
    }
    throw first;
  }
}
