import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type OpenAI from "openai";
import type { CritiqueResult } from "@/lib/types";
import type { CritiqueRequestPayload } from "@/lib/prompts";
import { attachSongVersionContext } from "@/lib/critique/attachSongVersionContext";
import {
  enableLineLevelNode,
  type CritiqueEngineModelRouting,
} from "@/lib/critique_engine/config/critique_engine_config";
import { critiqueEngineTimingKeys } from "@/lib/critique_engine/config/langfuse_node_labels";
import type { GenreContextOutput } from "@/lib/critique_engine/schemas/genre_context";
import type { CalibrationScoringOutput } from "@/lib/critique_engine/schemas/calibration_scoring";
import type { SynthesisOutput } from "@/lib/critique_engine/schemas/synthesis";
import type { LineFeedbackOutput } from "@/lib/critique_engine/schemas/line_feedback";
import type { SegmentedLyric } from "@/lib/critique_engine/utils/lyric_segmentation";
import {
  runCalibrationScoringNode,
  runGenreContextNode,
  runLineFeedbackNode,
  runSynthesisNode,
} from "@/lib/critique_engine/nodes/runNodes";
import { mergeCritiqueNodeOutputs } from "@/lib/critique_engine/orchestration/merge_outputs";

const CritiqueState = Annotation.Root({
  payload: Annotation<CritiqueRequestPayload>(),
  segmented: Annotation<SegmentedLyric>(),
  genreContext: Annotation<GenreContextOutput | undefined>(),
  calibrationScoring: Annotation<CalibrationScoringOutput | undefined>(),
  synthesis: Annotation<SynthesisOutput | undefined>(),
  lineFeedback: Annotation<LineFeedbackOutput | undefined>(),
  finalCritique: Annotation<CritiqueResult | undefined>(),
  nodeTimingsMs: Annotation<Record<string, number>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  lineFeedbackError: Annotation<string | undefined>(),
});

function shouldRunLineFeedback(state: typeof CritiqueState.State): boolean {
  if (state.payload.mode === "fast") return false;
  if (!enableLineLevelNode()) return false;
  return true;
}

export function compileCritiqueGraph(
  openai: OpenAI,
  models: CritiqueEngineModelRouting,
) {
  return new StateGraph(CritiqueState)
    .addNode("node_genre_context", async (state) => {
      const t0 = Date.now();
      const genreContext = await runGenreContextNode(openai, models, state.payload);
      return {
        genreContext,
        nodeTimingsMs: { [critiqueEngineTimingKeys.genreContext]: Date.now() - t0 },
      };
    })
    .addNode("node_calibration_scoring", async (state) => {
      const t0 = Date.now();
      const g = state.genreContext;
      if (!g) throw new Error("Missing genreContext");
      const calibrationScoring = await runCalibrationScoringNode(
        openai,
        models,
        state.payload,
        g,
      );
      return {
        calibrationScoring,
        nodeTimingsMs: {
          [critiqueEngineTimingKeys.calibrationScoring]: Date.now() - t0,
        },
      };
    })
    .addNode("node_synthesis", async (state) => {
      const t0 = Date.now();
      const g = state.genreContext;
      const c = state.calibrationScoring;
      if (!g || !c) throw new Error("Missing calibration inputs");
      const synthesis = await runSynthesisNode(openai, models, state.payload, g, c);
      return {
        synthesis,
        nodeTimingsMs: { [critiqueEngineTimingKeys.synthesis]: Date.now() - t0 },
      };
    })
    .addNode("node_line_feedback", async (state) => {
      const t0 = Date.now();
      const g = state.genreContext;
      const c = state.calibrationScoring;
      const s = state.synthesis;
      if (!g || !c || !s) throw new Error("Missing synthesis inputs");
      try {
        const lineFeedback = await runLineFeedbackNode(
          openai,
          models,
          state.payload,
          state.segmented,
          g,
          c,
          s,
        );
        return {
          lineFeedback,
          nodeTimingsMs: {
            [critiqueEngineTimingKeys.lineFeedback]: Date.now() - t0,
          },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        console.error("[critique] line-level-feedback node failed:", msg);
        return {
          lineFeedback: { annotations: [] },
          lineFeedbackError: msg,
          nodeTimingsMs: {
            [critiqueEngineTimingKeys.lineFeedback]: Date.now() - t0,
          },
        };
      }
    })
    .addNode("node_merge_outputs", async (state) => {
      const g = state.genreContext;
      const c = state.calibrationScoring;
      const s = state.synthesis;
      if (!g || !c || !s) throw new Error("Missing merge inputs");
      const lineAnnotations = state.lineFeedback?.annotations ?? [];
      const merged = mergeCritiqueNodeOutputs({
        payload: state.payload,
        genre: g,
        calibration: c,
        synthesis: s,
        lineAnnotations,
        segmented: state.segmented,
      });
      const finalCritique = attachSongVersionContext(merged, state.payload);
      return { finalCritique };
    })
    .addEdge(START, "node_genre_context")
    .addEdge("node_genre_context", "node_calibration_scoring")
    .addEdge("node_calibration_scoring", "node_synthesis")
    .addConditionalEdges("node_synthesis", (state) => {
      return shouldRunLineFeedback(state) ? "node_line_feedback" : "node_merge_outputs";
    })
    .addEdge("node_line_feedback", "node_merge_outputs")
    .addEdge("node_merge_outputs", END)
    .compile();
}

export type CritiqueGraphState = typeof CritiqueState.State;
