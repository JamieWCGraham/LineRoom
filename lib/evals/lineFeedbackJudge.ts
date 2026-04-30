import { z } from "zod";
import { runWithLangfuseTrace, scheduleLangfuseFlush } from "@/lib/langfuse-server";
import {
  createCritiqueGatewayOpenAI,
  getCritiqueGatewayModelId,
} from "@/lib/aiGatewayCritique";
import type { LineFeedbackItem } from "@/lib/types";
import type { GroundTruthLineFeedback } from "./lineFeedbackGroundTruth";
import { groundTruthLineFeedbackSchema } from "./lineFeedbackGroundTruth";

const BASELINE_LF_SYSTEM = `You are an expert lyric editor building a reference rubric for line-level critique quality in LineRoom.
Given full song metadata and lyrics, identify the highest-leverage lines for feedback (hooks, title lines, pivots, weakest moments, repetition, etc.).
Return only JSON with this exact shape:
{
  "mustCommentLines": ["exact substring copied from the lyric (one entry per line)", "..."],
  "optionalCommentLines": ["...", "..."],
  "anchorLines": [
    {
      "quotedLine": "exact substring from lyric",
      "role": "hook | title | pivot | chorus | verse | bridge | weak_spot | repetition | other",
      "expectedStrength": "strong" | "promising" | "suggestion",
      "rationale": "one short sentence why a critic should weigh in here"
    }
  ]
}
Rules:
- mustCommentLines: 4–12 distinct lyric fragments (not paraphrases) that a serious critic should address.
- optionalCommentLines: 0–8 additional fragments worth optional notes.
- anchorLines: same count as mustCommentLines, aligned by order when possible; each must use a quotedLine that appears verbatim in the lyrics.
- expectedStrength reflects how harsh/celebratory the line label should be: strong praise, promising craft, or suggestion-level revision pressure.`;

const QUALITY_JUDGE_SYSTEM = `You judge how good a model's line-by-line feedback is relative to human reference anchors for the same song.
Use the lyric as evidence. Compare predicted lineFeedback items to reference mustCommentLines, optionalCommentLines, and anchorLines.

Return only JSON:
{
  "coverage": number between 0 and 1,
  "label_calibration": number between 0 and 1,
  "specificity": integer 1-5,
  "revision_usefulness": integer 1-5,
  "context_awareness": integer 1-5,
  "failure_flags": string[],
  "notes": "1-4 short sentences"
}

Scoring guidance:
- coverage: fraction of mustCommentLines that are substantively addressed (exact quote not required if clearly the same line).
- label_calibration: how appropriate praise vs suggestion bands are vs anchorLines.expectedStrength.
- specificity: are notes concrete vs generic workshop filler?
- revision_usefulness: for weaker lines, do suggestions point a useful direction?
- context_awareness: notes respect the line's role in the song.

failure_flags (closed vocabulary; omit array entries if none apply):
generic_line_notes, mislabeled_strength, missed_must_line, low_revision_leverage, weak_context, redundant_line_feedback`;

const baselineOutSchema = groundTruthLineFeedbackSchema;

const qualitySchema = z.object({
  coverage: z.number().min(0).max(1),
  label_calibration: z.number().min(0).max(1),
  specificity: z.number().int().min(1).max(5),
  revision_usefulness: z.number().int().min(1).max(5),
  context_awareness: z.number().int().min(1).max(5),
  failure_flags: z.array(z.string()),
  notes: z.string(),
});

function mustJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function gatewayModelSupportsOpenAiJsonObjectMode(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith("openai/");
}

export type LineFeedbackQualityJudgeResult = z.infer<typeof qualitySchema>;

export async function generateBaselineGroundTruthLineFeedback(input: {
  title: string | null;
  artist: string | null;
  genre: string | null;
  lyrics: string;
  overallScore: string | null;
}): Promise<GroundTruthLineFeedback> {
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
      rootObservationName: "lineroom-eval-line-feedback-baseline",
      tags: ["lineroom", "evals", "line-feedback-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "line-feedback-baseline-annotation",
        tags: ["lineroom", "evals", "line-feedback-calibration", "llm-judge"],
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
          { role: "system", content: BASELINE_LF_SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty line-feedback baseline response");
      }
      const parsed = baselineOutSchema.parse(mustJson(raw));
      setTraceIO({ input: userPayload, output: parsed });
      return parsed;
    },
  );
}

export async function judgeLineFeedbackQuality(input: {
  lyrics: string;
  reference: GroundTruthLineFeedback;
  predictedLineFeedback: LineFeedbackItem[];
}): Promise<LineFeedbackQualityJudgeResult> {
  scheduleLangfuseFlush();
  const openai = createCritiqueGatewayOpenAI();
  const model = getCritiqueGatewayModelId();
  const payload = {
    lyrics: input.lyrics,
    reference: input.reference,
    predictedLineFeedback: input.predictedLineFeedback,
  };

  return runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName: "lineroom-eval-line-feedback-quality",
      tags: ["lineroom", "evals", "line-feedback-calibration", "llm-judge"],
      langfuseConfig: {
        traceName: "LineRoom",
        generationName: "line-feedback-quality-judge",
        tags: ["lineroom", "evals", "line-feedback-calibration", "llm-judge"],
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
          { role: "system", content: QUALITY_JUDGE_SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error("Empty line-feedback judge response");
      }
      const parsed = qualitySchema.parse(mustJson(raw));
      setTraceIO({ input: payload, output: parsed });
      return parsed;
    },
  );
}
