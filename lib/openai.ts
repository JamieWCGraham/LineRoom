import OpenAI from "openai";

export function createBaseOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

export function getChatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}

export function getFastChatModel(): string {
  return (
    process.env.OPENAI_FAST_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini"
  );
}

export function getDeepChatModel(): string {
  return (
    process.env.OPENAI_DEEP_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5-mini"
  );
}

/**
 * Chat Completions: newer models (e.g. GPT-5, o-series) reject `max_tokens` and require
 * `max_completion_tokens`. A few older IDs still expect `max_tokens`.
 */
export function chatCompletionTokenLimit(
  model: string,
  maxTokens: number,
): { max_tokens: number } | { max_completion_tokens: number } {
  const m = model.trim().toLowerCase();
  const legacyMaxTokens =
    m.includes("gpt-3.5") ||
    m.includes("gpt-4-0314") ||
    m.includes("gpt-4-0613") ||
    m.includes("gpt-4-32k") ||
    m === "gpt-4";
  if (legacyMaxTokens) {
    return { max_tokens: maxTokens };
  }
  return { max_completion_tokens: maxTokens };
}

/**
 * Some models only accept the default sampling temperature (1) and reject
 * custom values (common for GPT-5 and o-series). Omit `temperature` in that case.
 */
export function chatCompletionTemperature(
  model: string,
  temperature: number,
): { temperature: number } | Record<string, never> {
  const m = model.trim().toLowerCase();
  const defaultTemperatureOnly =
    m.includes("gpt-5") ||
    /^o[0-9]/.test(m) ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4");
  if (defaultTemperatureOnly) {
    return {};
  }
  return { temperature };
}
