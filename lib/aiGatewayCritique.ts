import OpenAI from "openai";
import { getCritiqueLlmProvider } from "@/lib/critique/critiqueLlmProvider";

/** Vercel AI Gateway OpenAI-compat base URL (see https://vercel.com/docs/ai-gateway/openai-compat). */
export function getAiGatewayBaseUrl(): string {
  const u = process.env.AI_GATEWAY_BASE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "https://ai-gateway.vercel.sh/v1";
}

/**
 * API key for AI Gateway (Bearer). Vercel docs use AI_GATEWAY_API_KEY.
 * VERCEL_AI_GATEWAY_API_KEY is accepted as an alias.
 */
export function getAiGatewayApiKey(): string {
  const key =
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_AI_GATEWAY_API_KEY?.trim();
  if (!key) {
    throw new Error("AI_GATEWAY_API_KEY is not set");
  }
  return key;
}

/**
 * OpenAI client configured for Vercel AI Gateway (used for generate critique only).
 */
export function createCritiqueGatewayOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: getAiGatewayApiKey(),
    baseURL: getAiGatewayBaseUrl(),
  });
}

/**
 * Gateway model id passed to `chat.completions.create({ model })`.
 *
 * Priority:
 * 1. `CRITIQUE_GATEWAY_MODEL` — full id, e.g. `openai/gpt-5-mini` or `google/gemini-3.1-pro-preview`
 * 2. Otherwise `CRITIQUE_LLM_PROVIDER`:
 *    - `openai` (default) → `openai/gpt-5-mini` (override with CRITIQUE_OPENAI_GATEWAY_MODEL)
 *    - `gemini` / `google` → `google/gemini-3.1-pro-preview` (override with CRITIQUE_GEMINI_GATEWAY_MODEL)
 */
export function getCritiqueGatewayModelId(): string {
  const explicit = process.env.CRITIQUE_GATEWAY_MODEL?.trim();
  if (explicit) return explicit;

  const p = getCritiqueLlmProvider();
  if (p === "gemini") {
    return (
      process.env.CRITIQUE_GEMINI_GATEWAY_MODEL?.trim() ||
      "google/gemini-3.1-pro-preview"
    );
  }
  return (
    process.env.CRITIQUE_OPENAI_GATEWAY_MODEL?.trim() || "openai/gpt-5-mini"
  );
}
