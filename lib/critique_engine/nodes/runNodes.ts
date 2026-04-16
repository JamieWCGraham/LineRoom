import type OpenAI from "openai";
import {
  buildCritiqueEngineContextBlocks,
  type CritiqueRequestPayload,
} from "@/lib/prompts";
import { loadCritiquePrompt } from "@/lib/critique_engine/utils/loadPrompt";
import { runOpenAiJsonNode } from "@/lib/critique_engine/orchestration/openai_json_node";
import type { CritiqueEngineModelRouting } from "@/lib/critique_engine/config/critique_engine_config";
import { critiqueEngineLangfuseSteps } from "@/lib/critique_engine/config/langfuse_node_labels";
import {
  genreContextOutputSchema,
  type GenreContextOutput,
} from "@/lib/critique_engine/schemas/genre_context";
import {
  calibrationScoringOutputSchema,
  type CalibrationScoringOutput,
} from "@/lib/critique_engine/schemas/calibration_scoring";
import {
  synthesisOutputSchema,
  type SynthesisOutput,
} from "@/lib/critique_engine/schemas/synthesis";
import {
  buildLineFeedbackOutputSchema,
  lineFeedbackAnnotationBounds,
  type LineFeedbackOutput,
} from "@/lib/critique_engine/schemas/line_feedback";
import {
  formatLyricsWithLineNumbers,
  type SegmentedLyric,
} from "@/lib/critique_engine/utils/lyric_segmentation";
import {
  getCachedGenreContext,
  setCachedGenreContext,
} from "@/lib/critique_engine/utils/genre_context_cache";
import { sanitizeForOpenAI } from "@/lib/critique/sanitizeForOpenAI";

function buildLineFeedbackSystemPrompt(
  bounds: ReturnType<typeof lineFeedbackAnnotationBounds>,
): string {
  const base = loadCritiquePrompt("line_feedback.md");
  return `${base}

MANDATORY (do not ignore — output will be rejected if violated):
- This draft has ${bounds.nonBlankLines} non-blank lines (${bounds.indexedLines} indexed lines including blanks in the numbered block).
- Return between ${bounds.min} and ${bounds.max} objects in the "annotations" array (inclusive). Fewer than ${bounds.min} is invalid.
- Each lineIndexStart must be an index that appears in [brackets] in the lyric block; quotedText must copy that line (or contiguous span) exactly.
- Do not return an empty "annotations" array.`;
}

function metaHeader(payload: CritiqueRequestPayload): string {
  return `Piece title: ${payload.title || "(untitled)"}
Genre (user-provided): ${payload.genre || "(unspecified)"}
Similar writers or artists / voice reference (user-provided): ${payload.similarArtists || "(none)"}`;
}

export async function runGenreContextNode(
  openai: OpenAI,
  models: CritiqueEngineModelRouting,
  payload: CritiqueRequestPayload,
): Promise<GenreContextOutput> {
  const cached = getCachedGenreContext(payload);
  if (cached) return cached;

  const user = sanitizeForOpenAI(
    `${metaHeader(payload)}${buildCritiqueEngineContextBlocks(payload)}

Lyrics/poetry (preserve line breaks):
---
${payload.fullText}
---`,
  );

  const { data } = await runOpenAiJsonNode({
    openai,
    observationName: critiqueEngineLangfuseSteps.genreContext,
    modelConfig: models.genreContext,
    systemMessages: [loadCritiquePrompt("genre_context.md")],
    userContent: user,
    schema: genreContextOutputSchema,
  });

  setCachedGenreContext(payload, data);
  return data;
}

export async function runCalibrationScoringNode(
  openai: OpenAI,
  models: CritiqueEngineModelRouting,
  payload: CritiqueRequestPayload,
  genre: GenreContextOutput,
): Promise<CalibrationScoringOutput> {
  const user = sanitizeForOpenAI(
    `${metaHeader(payload)}${buildCritiqueEngineContextBlocks(payload)}

Genre / style lens (JSON):
${JSON.stringify(genre)}

Lyrics/poetry:
---
${payload.fullText}
---`,
  );

  const { data } = await runOpenAiJsonNode({
    openai,
    observationName: critiqueEngineLangfuseSteps.calibrationScoring,
    modelConfig: models.calibrationScoring,
    systemMessages: [loadCritiquePrompt("calibration_scoring.md")],
    userContent: user,
    schema: calibrationScoringOutputSchema,
  });
  return data as CalibrationScoringOutput;
}

export async function runSynthesisNode(
  openai: OpenAI,
  models: CritiqueEngineModelRouting,
  payload: CritiqueRequestPayload,
  genre: GenreContextOutput,
  calibration: CalibrationScoringOutput,
): Promise<SynthesisOutput> {
  const regenNote =
    payload.regenerate && payload.priorCritique ?
      `\n\nREGENERATION MODE: Include exactly two sentences near the end of overallSummary comparing to the prior critique (better / worse / unchanged + concrete reason), as specified in the system prompt.`
    : "";

  const user = sanitizeForOpenAI(
    `${metaHeader(payload)}${buildCritiqueEngineContextBlocks(payload)}${regenNote}

Lyrics/poetry:
---
${payload.fullText}
---

Genre / style lens:
${JSON.stringify(genre)}

Calibration (JSON):
${JSON.stringify(calibration)}
`,
  );

  const { data } = await runOpenAiJsonNode({
    openai,
    observationName: critiqueEngineLangfuseSteps.synthesis,
    modelConfig: models.synthesis,
    systemMessages: [loadCritiquePrompt("synthesis.md")],
    userContent: user,
    schema: synthesisOutputSchema,
  });
  return data;
}

export async function runLineFeedbackNode(
  openai: OpenAI,
  models: CritiqueEngineModelRouting,
  payload: CritiqueRequestPayload,
  segmented: SegmentedLyric,
  genre: GenreContextOutput,
  calibration: CalibrationScoringOutput,
  synthesis: SynthesisOutput,
): Promise<LineFeedbackOutput> {
  const bounds = lineFeedbackAnnotationBounds(segmented);
  const schema = buildLineFeedbackOutputSchema(segmented);
  const numbered = formatLyricsWithLineNumbers(segmented);
  const user = sanitizeForOpenAI(
    `${metaHeader(payload)}${buildCritiqueEngineContextBlocks(payload)}

Lyrics with stable line indices (quote using these indices):
${numbered}

Genre / style lens:
${JSON.stringify(genre)}

Calibration:
${JSON.stringify(calibration)}

Synthesis:
${JSON.stringify(synthesis)}
`,
  );

  const systemPrimary = buildLineFeedbackSystemPrompt(bounds);

  try {
    const { data } = await runOpenAiJsonNode({
      openai,
      observationName: critiqueEngineLangfuseSteps.lineFeedback,
      modelConfig: models.lineFeedback,
      systemMessages: [systemPrimary],
      userContent: user,
      schema,
    });
    return data as LineFeedbackOutput;
  } catch (first) {
    const retryHint =
      "Your previous answer failed validation or was incomplete. Return a JSON object with an \"annotations\" array containing AT LEAST the minimum count from the system instructions. Each quotedText must match the numbered lyric lines exactly; lineIndexStart must match a [n] index.";
    const { data } = await runOpenAiJsonNode({
      openai,
      observationName: critiqueEngineLangfuseSteps.lineFeedback,
      modelConfig: models.lineFeedback,
      systemMessages: [systemPrimary, retryHint],
      userContent: user,
      schema,
    });
    return data as LineFeedbackOutput;
  }
}
