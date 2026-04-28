import { z } from "zod";
import { runWithLangfuseTrace, scheduleLangfuseFlush } from "@/lib/langfuse-server";
import {
  createCritiqueGatewayOpenAI,
  getCritiqueGatewayModelId,
} from "@/lib/aiGatewayCritique";
import type { LyricSubscoresJson } from "./subscoreCalibration";
import { lyricSubscoresJsonSchema } from "./subscoreCalibration";

const BASELINE_SUBSCORE_SYSTEM = `You are a strict lyric evaluation annotator.
Return only JSON with this shape:
{
  "subscores": {
    "emotional_impact": 1-5,
    "imagery_specificity": 1-5,
    "originality_voice": 1-5,
    "prosody_singability": 1-5,
    "structure_cohesion": 1-5,
    "lyrical_economy": 1-5,
    "hook_strength": 1-5
  },
  "notes": "1-3 short sentences"
}
Be calibrated and conservative.`;

const EXPLANATION_ALIGNMENT_SYSTEM = `You are evaluating whether written critique reasoning aligns with assigned subscores.
Return only JSON:
{
  "score": 1-5,
  "notes": "1-3 short sentences"
}
5 means strong alignment between rationale and subscores.`;

const baselineSchema = z.object({
  subscores: lyricSubscoresJsonSchema,
  notes: z.string(),
});

const explanationSchema = z.object({
  score: z.number().int().min(1).max(5),
  notes: z.string(),
});

function mustJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function gatewayModelSupportsOpenAiJsonObjectMode(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith("openai/");
}

export async function generateBaselineGroundTruthSubscores(input: {
  title: string | null;
  artist: string | null;
  genre: string | null;
  lyrics: string;
  overallScore: string | null;
}): Promise<{ subscores: LyricSubscoresJson; notes: string }> {
  scheduleLangfuseFlush();
  const openai = createCritiqueGatewayOpenAI();
  const model = getCritiqueGatewayModelId();
  const userPayload = {
    title: input.title,
    artist: input.artist,
    genre: input.genre,
    overallScore: input.overallScore,
    lyrics: input.lyrics,
  };

  return runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName: "lineroom-eval-subscore-baseline",
      tags: ["lineroom", "evals", "subscore-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "subscore-baseline-annotation",
        tags: ["lineroom", "evals", "subscore-calibration", "llm-judge"],
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const traced = createTracedOpenAI(openai);
      const completion = await traced.chat.completions.create({
        model,
        ...(gatewayModelSupportsOpenAiJsonObjectMode(model) ?
          { response_format: { type: "json_object" as const } }
        : {}),
        messages: [
          { role: "system", content: BASELINE_SUBSCORE_SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty baseline annotation response");
      }
      const parsed = baselineSchema.parse(mustJson(raw));
      setTraceIO({ input: userPayload, output: parsed });
      return parsed;
    },
  );
}

export async function judgeSubscoreExplanationAlignment(input: {
  lyrics: string;
  predictedSubscores: LyricSubscoresJson;
  groundTruthSubscores: LyricSubscoresJson;
  critiqueExplanation: string;
}): Promise<{ score: number; notes: string }> {
  scheduleLangfuseFlush();
  const openai = createCritiqueGatewayOpenAI();
  const model = getCritiqueGatewayModelId();
  return runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName: "lineroom-eval-subscore-explanation-alignment",
      tags: ["lineroom", "evals", "subscore-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "subscore-explanation-alignment",
        tags: ["lineroom", "evals", "subscore-calibration", "llm-judge"],
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const traced = createTracedOpenAI(openai);
      const payload = input;
      const completion = await traced.chat.completions.create({
        model,
        ...(gatewayModelSupportsOpenAiJsonObjectMode(model) ?
          { response_format: { type: "json_object" as const } }
        : {}),
        messages: [
          { role: "system", content: EXPLANATION_ALIGNMENT_SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty explanation-alignment response");
      }
      const parsed = explanationSchema.parse(mustJson(raw));
      setTraceIO({ input: payload, output: parsed });
      return parsed;
    },
  );
}
