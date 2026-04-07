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
