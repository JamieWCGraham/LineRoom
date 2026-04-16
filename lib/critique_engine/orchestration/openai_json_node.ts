import {
  startActiveObservation,
  type LangfuseGeneration,
} from "@langfuse/tracing";
import type OpenAI from "openai";
import type { z } from "zod";
import { isLangfuseEnabled } from "@/lib/langfuse-server";
import type { NodeModelConfig } from "@/lib/critique_engine/schemas/node_config";
import { chatCompletionTemperature, chatCompletionTokenLimit } from "@/lib/openai";

const REPAIR_HINT =
  "Your prior answer was invalid. Return ONLY one valid JSON object matching the required schema. No markdown or code fences. Ensure required keys, correct types, and all enum/string constraints.";

export type JsonNodeResult<T> = {
  data: T;
  raw: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  repaired: boolean;
  validationOk: boolean;
};

async function parseJsonStrict(raw: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("__EMPTY_MODEL__");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("__BAD_JSON__");
  }
}

function langfuseModelParameters(
  model: string,
  temperature: number,
  maxTokens: number,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const temp = chatCompletionTemperature(model, temperature);
  if ("temperature" in temp && typeof temp.temperature === "number") {
    out.temperature = temp.temperature;
  }
  const tok = chatCompletionTokenLimit(model, maxTokens);
  for (const [k, v] of Object.entries(tok)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

export async function runOpenAiJsonNode<T>(params: {
  openai: OpenAI;
  observationName: string;
  modelConfig: NodeModelConfig;
  systemMessages: string[];
  userContent: string;
  schema: z.ZodType<T>;
}): Promise<JsonNodeResult<T>> {
  const { openai, observationName, modelConfig, systemMessages, userContent, schema } =
    params;

  const runAttempts = async (
    generation: LangfuseGeneration | null,
  ): Promise<JsonNodeResult<T>> => {
    const attempt = async (
      repairHint?: string,
    ): Promise<JsonNodeResult<T>> => {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...systemMessages.map(
          (content): OpenAI.Chat.ChatCompletionSystemMessageParam => ({
            role: "system",
            content,
          }),
        ),
        ...(repairHint ?
          [
            {
              role: "system" as const,
              content: repairHint,
            },
          ]
        : []),
        { role: "user", content: userContent },
      ];

      generation?.update({
        model: modelConfig.model,
        input: messages,
        modelParameters: langfuseModelParameters(
          modelConfig.model,
          modelConfig.temperature,
          modelConfig.maxTokens,
        ),
        metadata: {
          responseFormat: "json_object",
          repairAttempt: Boolean(repairHint),
        },
      });

      const completion = await openai.chat.completions.create({
        model: modelConfig.model,
        ...chatCompletionTemperature(modelConfig.model, modelConfig.temperature),
        ...chatCompletionTokenLimit(modelConfig.model, modelConfig.maxTokens),
        response_format: { type: "json_object" },
        messages,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error("__EMPTY_MODEL__");
      const json = await parseJsonStrict(raw);
      const validated = schema.safeParse(json);
      if (!validated.success) {
        const err = new Error("__BAD_SHAPE__");
        (err as Error & { zodError?: unknown }).zodError = validated.error.flatten();
        throw err;
      }

      const usage = completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined;

      generation?.update({
        output: completion.choices[0]?.message ?? { role: "assistant", content: raw },
        usageDetails: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
        metadata: {
          repaired: Boolean(repairHint),
          validationOk: true,
        },
      });

      return {
        data: validated.data,
        raw,
        usage,
        repaired: Boolean(repairHint),
        validationOk: true,
      };
    };

    try {
      return await attempt();
    } catch (first) {
      const msg = first instanceof Error ? first.message : "";
      if (
        msg === "__EMPTY_MODEL__" ||
        msg === "__BAD_JSON__" ||
        msg === "__BAD_SHAPE__"
      ) {
        return await attempt(REPAIR_HINT);
      }
      throw first;
    }
  };

  if (!isLangfuseEnabled()) {
    return runAttempts(null);
  }

  return startActiveObservation(
    observationName,
    async (generation) => {
      try {
        return await runAttempts(generation);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        generation.update({
          level: "ERROR",
          statusMessage: message,
          output: { error: message },
        });
        throw err;
      }
    },
    { asType: "generation" },
  );
}
