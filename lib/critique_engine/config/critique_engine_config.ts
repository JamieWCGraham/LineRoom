import type { NodeModelConfig } from "@/lib/critique_engine/schemas/node_config";
import { getChatModel, getDeepChatModel, getFastChatModel } from "@/lib/openai";

export type CritiqueEngineModelRouting = {
  genreContext: NodeModelConfig;
  calibrationScoring: NodeModelConfig;
  synthesis: NodeModelConfig;
  lineFeedback: NodeModelConfig;
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function nodeConfig(
  modelEnv: string | undefined,
  fallbackModel: string,
  temperature: number,
  maxTokens: number,
): NodeModelConfig {
  const model = modelEnv?.trim() || fallbackModel;
  return { model, temperature, maxTokens };
}

/**
 * Per-node model routing. Model names come from env — never hardcode in node files.
 */
export function getCritiqueEngineModelRouting(): CritiqueEngineModelRouting {
  const fast = getFastChatModel();
  const deep = getDeepChatModel();
  const base = getChatModel();

  return {
    genreContext: nodeConfig(
      process.env.CRITIQUE_MODEL_GENRE_CONTEXT,
      fast,
      numEnv("CRITIQUE_TEMP_GENRE_CONTEXT", 0.35),
      numEnv("CRITIQUE_MAX_TOKENS_GENRE_CONTEXT", 700),
    ),
    calibrationScoring: nodeConfig(
      process.env.CRITIQUE_MODEL_CALIBRATION,
      deep,
      numEnv("CRITIQUE_TEMP_CALIBRATION", 0.25),
      numEnv("CRITIQUE_MAX_TOKENS_CALIBRATION", 2200),
    ),
    synthesis: nodeConfig(
      process.env.CRITIQUE_MODEL_SYNTHESIS,
      base,
      numEnv("CRITIQUE_TEMP_SYNTHESIS", 0.4),
      numEnv("CRITIQUE_MAX_TOKENS_SYNTHESIS", 1800),
    ),
    lineFeedback: nodeConfig(
      process.env.CRITIQUE_MODEL_LINE_FEEDBACK,
      base,
      numEnv("CRITIQUE_TEMP_LINE_FEEDBACK", 0.35),
      numEnv("CRITIQUE_MAX_TOKENS_LINE_FEEDBACK", 4096),
    ),
  };
}

export const PROMPT_VERSIONS = {
  genreContext: "v1",
  calibrationScoring: "v1",
  synthesis: "v1",
  lineFeedback: "v1",
} as const;

export function useMultinodeCritiqueEngine(): boolean {
  const v = process.env.USE_MULTINODE_CRITIQUE_ENGINE?.trim().toLowerCase();
  if (!v) return true;
  return v === "1" || v === "true" || v === "yes";
}

export function enableLineLevelNode(): boolean {
  const v = process.env.ENABLE_LINE_LEVEL_NODE?.trim().toLowerCase();
  if (!v) return true;
  return v === "1" || v === "true" || v === "yes";
}
