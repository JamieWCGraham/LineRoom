import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
  type LangfuseTraceUser,
} from "@/lib/langfuse-server";
import {
  createCritiqueGatewayOpenAI,
  getCritiqueGatewayModelId,
  getCritiqueGatewayProvider,
} from "@/lib/aiGatewayCritique";
import { getCritiqueLlmProvider } from "@/lib/critique/critiqueLlmProvider";
import { createAiObservabilityContext } from "@/lib/openai";
import {
  getCritiqueNetworkRetryDelayMs,
  isRetriableOpenAICritiqueError,
  rethrowIfBadRequest,
  sleepMs,
} from "@/lib/critique/critiqueNetworkRetry";
import type { DraftCritiqueGateContext } from "@/lib/critique/draftCritiqueGate";
import {
  applyCanonicalScores,
  scoresMatchCanonical,
} from "@/lib/critique/enforceCanonicalScores";
import {
  buildCritiqueScoreInvarianceRepairHint,
  buildCritiqueUserPayload,
  CANONICAL_SCORE_LOCK_SYSTEM_ADDENDUM,
  CRITIQUE_JSON_INSTRUCTIONS,
} from "@/lib/prompts";
import type { CritiqueResult } from "@/lib/types";
import {
  critiqueRequestSchema,
  critiqueResultSchema,
} from "@/lib/validators";
import type { z } from "zod";

type CritiqueRequestPayload = z.infer<typeof critiqueRequestSchema>;

const CRITIQUE_REPAIR_HINT = [
  "Your prior answer was invalid.",
  "Return ONLY one valid JSON object that strictly matches the required schema.",
  "Do not include markdown, code fences, or commentary.",
  "Ensure every required key is present with correct types.",
].join(" ");

function attachSongVersionContext(
  critique: z.infer<typeof critiqueResultSchema>,
  payload: {
    analyzedSongVersion?: number;
    priorSongVersionCompared?: number | null;
    regenerate?: boolean;
  },
): CritiqueResult {
  const out = { ...critique };
  if (typeof payload.analyzedSongVersion === "number") {
    out.analyzedSongVersion = payload.analyzedSongVersion;
  } else {
    delete out.analyzedSongVersion;
    delete out.priorSongVersionCompared;
    delete out.comparedToSummary;
    return out;
  }

  if (payload.priorSongVersionCompared !== undefined) {
    out.priorSongVersionCompared = payload.priorSongVersionCompared;
  }

  if (payload.priorSongVersionCompared != null) {
    out.comparedToSummary = `Full saved lyrics draft and critique from version ${payload.priorSongVersionCompared} were included for comparison.`;
  } else if (payload.regenerate) {
    out.comparedToSummary = `Compared to the previous critique and the saved lyrics draft for version ${payload.analyzedSongVersion} from when this page was loaded (before your latest edits).`;
  } else {
    delete out.comparedToSummary;
  }

  return out;
}

export type RunCritiqueModelOptions = {
  /** Langfuse user id + metadata (display name, email) for production traces. */
  traceUser?: LangfuseTraceUser;
  /** Langfuse / trace labels (default: production critique). */
  traceTags?: string[];
  rootObservationName?: string;
  generationName?: string;
  /** When true, skip draft registry lookup context (eval / dev paths). */
  skipDraftCritiqueGate?: boolean;
  gate?: DraftCritiqueGateContext;
};

/**
 * Strip C0/C1 control characters (except tab \t, newline \n, carriage-return \r)
 * from a string before including it in an LLM API request body.
 */
function sanitizeForLlmRequest(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
}

/**
 * OpenAI Chat Completions `response_format: { type: "json_object" }` is not accepted
 * for all AI Gateway backends (e.g. `google/...` often returns 400 "malformed body").
 * Keep JSON mode for OpenAI-routed models; others rely on the system prompt + Zod + repair retry.
 */
function gatewayModelSupportsOpenAiJsonObjectMode(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith("openai/");
}

function parseModelJsonToCritique(
  raw: string,
  payload: CritiqueRequestPayload,
): CritiqueResult {
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("__BAD_JSON__");
  }

  const validated = critiqueResultSchema.safeParse(json);
  if (!validated.success) {
    console.error(
      "[runCritiqueModel] __BAD_SHAPE__ validation errors:",
      JSON.stringify(validated.error.flatten(), null, 2),
    );
    throw new Error("__BAD_SHAPE__");
  }

  return attachSongVersionContext(validated.data, payload);
}

function resolveGateContext(
  options?: RunCritiqueModelOptions,
): DraftCritiqueGateContext {
  if (options?.skipDraftCritiqueGate) return { kind: "off" };
  return options?.gate ?? { kind: "miss" };
}

function enforceGateScoresIfNeeded(
  critique: CritiqueResult,
  gate: DraftCritiqueGateContext,
): { critique: CritiqueResult; scoreEnforced: boolean } {
  if (gate.kind !== "hit") {
    return { critique, scoreEnforced: false };
  }
  if (scoresMatchCanonical(critique, gate.canonical)) {
    return { critique, scoreEnforced: false };
  }
  console.warn(
    "[runCritiqueModel] draft_gate_score_enforced",
    gate.fingerprintPrefix,
  );
  return {
    critique: applyCanonicalScores(critique, gate.canonical),
    scoreEnforced: true,
  };
}

/**
 * Runs the lyric critique LLM call via **Vercel AI Gateway** (same path as POST /api/critique).
 */
export async function runCritiqueModel(
  payload: CritiqueRequestPayload,
  options?: RunCritiqueModelOptions,
): Promise<{ critique: CritiqueResult; userContent: string }> {
  scheduleLangfuseFlush();
  const gate = resolveGateContext(options);
  const userContent = sanitizeForLlmRequest(
    buildCritiqueUserPayload({
      ...payload,
      canonicalPriorScores:
        gate.kind === "hit" ? gate.canonical : undefined,
    }),
  );
  const systemContent =
    gate.kind === "hit" ?
      `${CRITIQUE_JSON_INSTRUCTIONS}\n\n${CANONICAL_SCORE_LOCK_SYSTEM_ADDENDUM}`
    : CRITIQUE_JSON_INSTRUCTIONS;

  const baseTags = options?.traceTags ?? ["lineroom", "critique"];
  const gateTag =
    gate.kind === "hit" ? "draft_gate_hit"
    : gate.kind === "off" ? null
    : "draft_gate_miss";
  const tags = gateTag ? [...baseTags, gateTag] : baseTags;
  const rootObservationName =
    options?.rootObservationName ?? "lineroom-critique";
  const generationName = options?.generationName ?? "lyric-critique";
  const provider = getCritiqueLlmProvider();
  const gatewayModelId = getCritiqueGatewayModelId();
  const aiObservabilityContext = createAiObservabilityContext({
    distinctId: options?.traceUser?.userId,
    provider: getCritiqueGatewayProvider(gatewayModelId),
  });

  const critique = await runWithLangfuseTrace(
    {
      traceName: "LineRoom",
      rootObservationName,
      tags,
      traceUser: options?.traceUser,
      langfuseConfig: {
        traceName: "LineRoom",
        generationName,
        tags,
      },
    },
    async ({ createTracedOpenAI, setTraceIO }) => {
      const tracePayload = {
        messages: payload,
        critiqueLlmProvider: provider,
        critiqueGatewayModel: gatewayModelId,
      };

      const openai = createTracedOpenAI(createCritiqueGatewayOpenAI());

      const completeOnce = async (
        extraSystemHints: string[] = [],
      ): Promise<CritiqueResult> => {
        const completion = await openai.chat.completions.create({
          ...aiObservabilityContext,
          model: gatewayModelId,
          ...(gatewayModelSupportsOpenAiJsonObjectMode(gatewayModelId) ?
            { response_format: { type: "json_object" as const } }
          : {}),
          messages: [
            { role: "system", content: systemContent },
            ...extraSystemHints.map(
              (content) => ({ role: "system" as const, content }),
            ),
            { role: "user", content: userContent },
          ],
        });

        const raw = completion.choices[0]?.message?.content?.trim();
        if (!raw) {
          throw new Error("__EMPTY_MODEL__");
        }

        return parseModelJsonToCritique(raw, payload);
      };

      const completeWithGateEnforcement = async (
        extraSystemHints: string[] = [],
      ): Promise<CritiqueResult> => {
        let c = await completeOnce(extraSystemHints);
        if (gate.kind !== "hit") return c;
        if (scoresMatchCanonical(c, gate.canonical)) return c;

        const invarianceHint = buildCritiqueScoreInvarianceRepairHint(
          gate.canonical,
        );
        c = await completeOnce([...extraSystemHints, invarianceHint]);
        const { critique: enforced, scoreEnforced } = enforceGateScoresIfNeeded(
          c,
          gate,
        );
        if (scoreEnforced) {
          console.warn(
            "[runCritiqueModel] draft_gate_score_enforced after repair",
            gate.fingerprintPrefix,
          );
        }
        return enforced;
      };

      let c: CritiqueResult;
      try {
        c = await completeWithGateEnforcement();
      } catch (first) {
        rethrowIfBadRequest(first);

        const firstMessage =
          first instanceof Error ? first.message : "Unknown error";

        if (isRetriableOpenAICritiqueError(first)) {
          await sleepMs(getCritiqueNetworkRetryDelayMs());
          c = await completeWithGateEnforcement();
          setTraceIO({
            input: tracePayload,
            output: c,
          });
          return c;
        }

        if (
          firstMessage === "__EMPTY_MODEL__" ||
          firstMessage === "__BAD_JSON__" ||
          firstMessage === "__BAD_SHAPE__"
        ) {
          c = await completeWithGateEnforcement([CRITIQUE_REPAIR_HINT]);
        } else {
          throw first;
        }
      }

      setTraceIO({
        input: tracePayload,
        output: c,
      });
      return c;
    },
  );

  return { critique, userContent };
}
