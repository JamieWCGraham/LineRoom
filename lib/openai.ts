import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import { PostHog } from "posthog-node";
import { after } from "next/server";
import OpenAI from "openai";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (process.env.NODE_ENV !== "production") {
  if (!posthogProjectToken) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }
  if (!posthogHost) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
}

export const posthogAiClient =
  posthogProjectToken && posthogHost ?
    new PostHog(posthogProjectToken, {
      host: posthogHost,
      privacyMode: false,
      enableExceptionAutocapture: true,
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

export function createAiObservabilityContext(options?: {
  distinctId?: string;
  provider?: string;
}) {
  return {
    posthogTraceId: crypto.randomUUID(),
    posthogProperties: {
      $ai_session_id: `server-process-${process.pid}`,
      ...(options?.provider ? { $ai_provider: options.provider } : {}),
    },
    ...(options?.distinctId ? { posthogDistinctId: options.distinctId } : {}),
  };
}

export function createOpenAIClient(
  options: ConstructorParameters<typeof OpenAI>[0] & { apiKey: string },
): OpenAI {
  if (!posthogAiClient) {
    return new OpenAI(options);
  }
  const monitoredOptions = {
    ...options,
    posthog: posthogAiClient,
  } as ConstructorParameters<typeof PostHogOpenAI>[0];
  return new PostHogOpenAI(monitoredOptions) as unknown as OpenAI;
}

export function schedulePostHogAiFlush(): void {
  if (!posthogAiClient) {
    return;
  }
  after(async () => {
    try {
      await posthogAiClient.flush();
    } catch (error) {
      console.error("[posthog-ai] flush failed", error);
    }
  });
}

export function createBaseOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return createOpenAIClient({ apiKey: key });
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
