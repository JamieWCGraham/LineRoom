import { compileCritiqueGraph } from "@/lib/critique_engine/orchestration/critique_graph";
import { getCritiqueEngineModelRouting } from "@/lib/critique_engine/config/critique_engine_config";
import { segmentLyrics } from "@/lib/critique_engine/utils/lyric_segmentation";
import { persistCritiqueEngineRun } from "@/lib/critique_engine/persistence/persistCritiqueEngineRun";
import type { CritiqueRequestPayload } from "@/lib/prompts";
import type { CritiqueResult } from "@/lib/types";
import type OpenAI from "openai";

function nodeOutputsSnapshot(s: {
  genreContext?: unknown;
  calibrationScoring?: unknown;
  synthesis?: unknown;
  lineFeedback?: unknown;
  lineFeedbackError?: string;
}) {
  return {
    genreContext: s.genreContext,
    calibrationScoring: s.calibrationScoring,
    synthesis: s.synthesis,
    lineFeedback: s.lineFeedback,
    lineFeedbackError: s.lineFeedbackError,
  };
}

export async function runMultinodeCritiqueEngine(
  openai: OpenAI,
  payload: CritiqueRequestPayload,
  options?: { userId?: string; sessionId?: string },
): Promise<{
  critique: CritiqueResult;
  userContent: string;
  timings: Record<string, number>;
}> {
  const segmented = segmentLyrics(payload.fullText);
  const models = getCritiqueEngineModelRouting();
  const sessionId = options?.sessionId ?? crypto.randomUUID();
  const app = compileCritiqueGraph(openai, models);

  try {
    const graphState = await app.invoke({
      payload,
      segmented,
      nodeTimingsMs: {},
    });

    if (!graphState.finalCritique) {
      throw new Error("Multinode critique missing final output");
    }

    const lineRan = payload.mode !== "fast";
    const userContent = [
      "[multinode-critique]",
      `session=${sessionId}`,
      lineRan ? "line_feedback=attempted" : "line_feedback=skipped(fast_or_disabled)",
    ].join(" ");

    await persistCritiqueEngineRun({
      userId: options?.userId,
      sessionId,
      payload,
      nodeOutputs: nodeOutputsSnapshot(graphState),
      finalOutput: graphState.finalCritique,
      modelConfigs: models,
      timings: graphState.nodeTimingsMs,
      success: true,
    });

    return {
      critique: graphState.finalCritique,
      userContent,
      timings: graphState.nodeTimingsMs ?? {},
    };
  } catch (e) {
    await persistCritiqueEngineRun({
      userId: options?.userId,
      sessionId,
      payload,
      nodeOutputs: null,
      finalOutput: null,
      modelConfigs: models,
      timings: {},
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
