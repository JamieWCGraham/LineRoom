import { z } from "zod";
import { runWithLangfuseTrace, scheduleLangfuseFlush } from "@/lib/langfuse-server";
import {
  createCritiqueGatewayOpenAI,
  getCritiqueGatewayModelId,
  getCritiqueGatewayProvider,
} from "@/lib/aiGatewayCritique";
import { createAiObservabilityContext } from "@/lib/openai";
import type { GroundTruthStrengthsWeaknesses } from "./strengthWeaknessGroundTruth";

const BASELINE_SW_SYSTEM = `You are an expert lyric critic annotating reference "top strengths" and "top weaknesses" for an evaluation set.
Each bullet must be concrete: quote or paraphrase specific lyric material, name structural or craft choices, and avoid generic workshop language.
Return only JSON with this exact shape:
{
  "overallStrengths": ["...", "..."],
  "overallWeaknesses": ["...", "..."]
}
Use 2–5 bullets per side. Weaknesses should suggest a revision direction where possible.`;

const QUALITY_JUDGE_SYSTEM = `You judge how well a model's "overall strengths" and "overall weaknesses" match the spirit and coverage of human reference bullets for the same song, using the lyric as evidence.
Score 1–5 on each rubric dimension (5 = strong). Use failure_flags only when clearly warranted; pick from this closed set (omit if none apply):
generic_praise, generic_criticism, redundant_points, unsupported_claim, missed_major_strength, missed_major_weakness, too_soft, too_harsh
Return only JSON:
{
  "specificity": 1-5,
  "evidence_grounding": 1-5,
  "non_redundancy": 1-5,
  "actionability": 1-5,
  "fairness": 1-5,
  "failure_flags": ["..."],
  "notes": "1-3 short sentences"
}`;

const baselineSchema = z.object({
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
});

const qualitySchema = z.object({
  specificity: z.number().int().min(1).max(5),
  evidence_grounding: z.number().int().min(1).max(5),
  non_redundancy: z.number().int().min(1).max(5),
  actionability: z.number().int().min(1).max(5),
  fairness: z.number().int().min(1).max(5),
  failure_flags: z.array(z.string()),
  notes: z.string(),
});

function mustJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function gatewayModelSupportsOpenAiJsonObjectMode(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith("openai/");
}

export type StrengthWeaknessQualityResult = z.infer<typeof qualitySchema>;

export async function generateBaselineGroundTruthStrengthsWeaknesses(input: {
  title: string | null;
  artist: string | null;
  genre: string | null;
  lyrics: string;
  overallScore: string | null;
}): Promise<GroundTruthStrengthsWeaknesses> {
  scheduleLangfuseFlush();
  const openai = createCritiqueGatewayOpenAI();
  const model = getCritiqueGatewayModelId();
  const aiObservabilityContext = createAiObservabilityContext({
    provider: getCritiqueGatewayProvider(model),
  });
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
      rootObservationName: "lineroom-eval-sw-baseline",
      tags: ["lineroom", "evals", "strength-weakness-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "strength-weakness-baseline-annotation",
        tags: ["lineroom", "evals", "strength-weakness-calibration", "llm-judge"],
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const traced = createTracedOpenAI(openai);
      const completion = await traced.chat.completions.create({
        ...aiObservabilityContext,
        model,
        ...(gatewayModelSupportsOpenAiJsonObjectMode(model) ?
          { response_format: { type: "json_object" as const } }
        : {}),
        messages: [
          { role: "system", content: BASELINE_SW_SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty strengths/weaknesses baseline response");
      }
      const parsed = baselineSchema.parse(mustJson(raw));
      setTraceIO({ input: userPayload, output: parsed });
      return parsed;
    },
  );
}

export async function judgeStrengthWeaknessQuality(input: {
  lyrics: string;
  reference: GroundTruthStrengthsWeaknesses;
  predictedStrengths: string[];
  predictedWeaknesses: string[];
}): Promise<StrengthWeaknessQualityResult> {
  scheduleLangfuseFlush();
  const openai = createCritiqueGatewayOpenAI();
  const model = getCritiqueGatewayModelId();
  const aiObservabilityContext = createAiObservabilityContext({
    provider: getCritiqueGatewayProvider(model),
  });
  const payload = {
    lyrics: input.lyrics,
    referenceStrengths: input.reference.overallStrengths,
    referenceWeaknesses: input.reference.overallWeaknesses,
    predictedStrengths: input.predictedStrengths,
    predictedWeaknesses: input.predictedWeaknesses,
  };

  return runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName: "lineroom-eval-strength-weakness-quality",
      tags: ["lineroom", "evals", "strength-weakness-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "strength-weakness-quality-judge",
        tags: ["lineroom", "evals", "strength-weakness-calibration", "llm-judge"],
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const traced = createTracedOpenAI(openai);
      const completion = await traced.chat.completions.create({
        ...aiObservabilityContext,
        model,
        ...(gatewayModelSupportsOpenAiJsonObjectMode(model) ?
          { response_format: { type: "json_object" as const } }
        : {}),
        messages: [
          { role: "system", content: QUALITY_JUDGE_SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty strength/weakness judge response");
      }
      const parsed = qualitySchema.parse(mustJson(raw));
      setTraceIO({ input: payload, output: parsed });
      return parsed;
    },
  );
}
