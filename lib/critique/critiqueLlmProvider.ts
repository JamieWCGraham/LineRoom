export type CritiqueLlmProvider = "openai" | "gemini";

/**
 * Which **default** gateway model profile critique uses when `CRITIQUE_GATEWAY_MODEL` is unset.
 * All critique traffic goes through Vercel AI Gateway (`lib/aiGatewayCritique.ts`).
 *
 * - `openai` → `openai/gpt-5-mini` (override: `CRITIQUE_OPENAI_GATEWAY_MODEL`)
 * - `gemini` or `google` → `google/gemini-3.1-pro-preview` (override: `CRITIQUE_GEMINI_GATEWAY_MODEL`)
 *
 * To pick any gateway model explicitly, set `CRITIQUE_GATEWAY_MODEL` (this toggle is ignored).
 */
export function getCritiqueLlmProvider(): CritiqueLlmProvider {
  const v = process.env.CRITIQUE_LLM_PROVIDER?.trim().toLowerCase();
  if (v === "gemini" || v === "google") return "gemini";
  return "openai";
}
