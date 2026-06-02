import { propagateAttributes } from "@langfuse/core";
import { observeOpenAI, type LangfuseConfig } from "@langfuse/openai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation } from "@langfuse/tracing";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import OpenAI from "openai";
import { after } from "next/server";

let tracerProvider: NodeTracerProvider | null = null;
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
  if (!isLangfuseEnabled() || tracerProvider) {
    return;
  }
  spanProcessor = new LangfuseSpanProcessor({
    exportMode: "immediate",
  });
  tracerProvider = new NodeTracerProvider({
    spanProcessors: [spanProcessor],
  });
  tracerProvider.register();
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

type TraceIO = { input: unknown; output: unknown };

/** Trace-level user context (values truncated to Langfuse’s 200-char limit). */
export type LangfuseTraceUser = {
  userId: string;
  email?: string;
  displayName?: string;
};

function langfuseString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

function traceUserPropagation(
  traceUser?: LangfuseTraceUser,
): { userId?: string; metadata?: Record<string, string> } {
  if (!traceUser?.userId) return {};
  const metadata: Record<string, string> = {};
  const email = langfuseString(traceUser.email);
  const displayName = langfuseString(traceUser.displayName);
  if (email) metadata.email = email;
  if (displayName) metadata.displayName = displayName;
  return {
    userId: traceUser.userId,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

/**
 * Runs work inside a root Langfuse span with propagated trace name/tags, and nests
 * OpenAI generations under it via parentSpanContext. Call setTraceIO before returning
 * so the Langfuse trace view shows Input/Output (the SDK generation alone often leaves
 * trace-level I/O empty).
 */
export async function runWithLangfuseTrace<T>(
  params: {
    traceName: string;
    rootObservationName: string;
    tags?: string[];
    traceUser?: LangfuseTraceUser;
    langfuseConfig: Omit<LangfuseConfig, "parentSpanContext">;
  },
  fn: (ctx: {
    createTracedOpenAI: (client: OpenAI) => OpenAI;
    setTraceIO: (io: TraceIO) => void;
  }) => Promise<T>,
): Promise<T> {
  if (!isLangfuseEnabled()) {
    return fn({
      setTraceIO: () => {},
      createTracedOpenAI: (client) => createTracedOpenAI(client, params.langfuseConfig),
    });
  }

  return propagateAttributes(
    {
      traceName: params.traceName,
      tags: params.tags,
      ...traceUserPropagation(params.traceUser),
    },
    () =>
      startActiveObservation(params.rootObservationName, async (root) => {
        const parentSpanContext = root.otelSpan.spanContext();
        return fn({
          setTraceIO: ({ input, output }) => {
            root.setTraceIO({ input, output });
          },
          createTracedOpenAI: (client) =>
            createTracedOpenAI(client, {
              ...params.langfuseConfig,
              parentSpanContext,
            }),
        });
      }),
  );
}
