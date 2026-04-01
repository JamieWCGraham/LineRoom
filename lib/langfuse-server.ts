import { observeOpenAI, type LangfuseConfig } from "@langfuse/openai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import OpenAI from "openai";
import { after } from "next/server";

let sdk: NodeSDK | null = null;
let spanProcessor: LangfuseSpanProcessor | null = null;

export function isLangfuseEnabled(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY?.trim() &&
      process.env.LANGFUSE_PUBLIC_KEY?.trim(),
  );
}

/**
 * Call once from Next.js `instrumentation.ts` (Node runtime only).
 * No-ops when Langfuse env vars are unset.
 */
export function startLangfuseOtel(): void {
  if (!isLangfuseEnabled() || sdk) {
    return;
  }
  spanProcessor = new LangfuseSpanProcessor({
    exportMode: "immediate",
  });
  sdk = new NodeSDK({
    spanProcessors: [spanProcessor],
  });
  sdk.start();
}

export async function flushLangfuse(): Promise<void> {
  await spanProcessor?.forceFlush();
}

/**
 * Ensures buffered spans are sent after the response (required for Vercel / serverless).
 */
export function scheduleLangfuseFlush(): void {
  if (!isLangfuseEnabled()) {
    return;
  }
  after(async () => {
    await flushLangfuse();
  });
}

export function createTracedOpenAI(
  client: OpenAI,
  langfuseConfig: LangfuseConfig,
): OpenAI {
  if (!isLangfuseEnabled()) {
    return client;
  }
  return observeOpenAI(client, langfuseConfig) as OpenAI;
}
