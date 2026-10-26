import { NextResponse } from "next/server";
import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import { buildLangfuseTraceUser } from "@/lib/langfuse/traceUser";
import { posthogLog, schedulePostHogLogFlush } from "@/lib/posthog-logs";
import {
  createAiObservabilityContext,
  createBaseOpenAI,
  getFastChatModel,
} from "@/lib/openai";
import { buildChatActionSystemPrompt } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/guards";
import { isAnonymousUser } from "@/lib/auth/guest";
import type { CritiqueMeta, CritiqueResult } from "@/lib/types";
import type { ChatActionPayload, ChatActionResponse } from "@/types/chat";
import {
  chatActionResponseSchema,
  chatRequestSchema,
} from "@/lib/validators";

function formatCritiqueForChat(
  critique: CritiqueResult | undefined,
  meta: CritiqueMeta | undefined,
  pieceTitle?: string,
): string | undefined {
  if (!critique) return undefined;
  const title =
    pieceTitle?.trim() || meta?.title?.trim() || "(untitled)";
  const header =
    meta ?
      `Title: ${title}\nGenre: ${meta.genre || "—"}\nReference (writers/artists): ${meta.similarArtists || "—"}\n`
    : `Title: ${title}\n`;
  const strengths = critique.overallStrengths.map((s) => `- ${s}`).join("\n");
  const weaknesses = critique.overallWeaknesses
    .map((s) => `- ${s}`)
    .join("\n");
  const lines = critique.lineFeedback
    .map(
      (l) =>
        `Line: ${l.quotedLine}\nStrength: ${l.strength ?? (l.category === "praise" ? "strong" : "suggestion")}\nNote: ${l.feedback}`,
    )
    .join("\n\n");
  const subscores = Object.entries(critique.subscores)
    .map(([dimension, score]) => `- ${dimension}: ${score}/5`)
    .join("\n");
  const versionBlock =
    critique.analyzedSongVersion != null ?
      `Version analyzed: ${critique.analyzedSongVersion}${
        critique.priorSongVersionCompared != null ?
          `\nCompared to version: ${critique.priorSongVersionCompared}`
        : ""
      }${critique.comparedToSummary ? `\n${critique.comparedToSummary}` : ""}\n\n`
    : "";
  return `${header}${versionBlock}Overall rating band: ${critique.overallRatingBand}
${critique.overallBandRationale ? `Band rationale: ${critique.overallBandRationale}\n` : ""}Subscores:
${subscores}

Genre principles:
${critique.genrePrinciples}

Overall strengths:
${strengths}

Overall weaknesses:
${weaknesses}

Line-level notes:
${lines}`;
}

function parseModelJsonObject(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/u, "")
      .trim();
  }
  return JSON.parse(s) as unknown;
}

function validateChatActionPayload(payload: ChatActionPayload): string | null {
  if (payload.scope === "selection") {
    const parts = payload.selections?.filter((s) => s.text?.trim()) ?? [];
    if (parts.length === 0) {
      return "Selection scope requires at least one excerpt added from the draft.";
    }
  }
  if (payload.scope === "section") {
    if (!payload.section?.text?.trim()) {
      return "Section scope requires section text.";
    }
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isAnonymousUser(user)) {
    return NextResponse.json(
      {
        error: "Workshop is available for signed-up users. Sign up to continue.",
        signupRequired: true,
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fullText, pieceTitle, messages, critique, critiqueMeta, chatAction } =
    parsed.data;
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "At least one message is required" },
      { status: 400 },
    );
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user" },
      { status: 400 },
    );
  }

  scheduleLangfuseFlush();
  schedulePostHogLogFlush();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const traceUser = buildLangfuseTraceUser(user, profile);

  const effectiveCritique = critique ?? chatAction.critique;
  const critiqueBlock = formatCritiqueForChat(
    effectiveCritique,
    critiqueMeta,
    pieceTitle,
  );

  const payload: ChatActionPayload = {
    ...chatAction,
    draft: fullText,
    critique: effectiveCritique,
  };
  const scopeErr = validateChatActionPayload(payload);
  if (scopeErr) {
    return NextResponse.json({ error: scopeErr }, { status: 400 });
  }

  try {
    return await runWithLangfuseTrace(
      {
        traceName: "LineRoom",
        rootObservationName: "lineroom-chat-action",
        tags: ["lineroom", "chat", "action"],
        traceUser,
        langfuseConfig: {
          traceName: "LineRoom",
          generationName: "lyric-chat-action",
          tags: ["lineroom", "chat", "action"],
        },
      },
      async ({ createTracedOpenAI, setTraceIO }) => {
        const openai = createTracedOpenAI(createBaseOpenAI());
        const aiObservabilityContext = createAiObservabilityContext({
          distinctId: user.id,
          provider: "openai",
        });
        const system = buildChatActionSystemPrompt(payload, critiqueBlock);
        const completion = await openai.chat.completions.create({
          ...aiObservabilityContext,
          model: getFastChatModel(),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: chatAction.userMessage },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim();
        if (!raw) {
          return NextResponse.json(
            { error: "Empty model response" },
            { status: 502 },
          );
        }
        let json: unknown;
        try {
          json = parseModelJsonObject(raw);
        } catch {
          return NextResponse.json(
            { error: "Model returned invalid JSON" },
            { status: 502 },
          );
        }
        const shaped = chatActionResponseSchema.safeParse(json);
        if (!shaped.success) {
          return NextResponse.json(
            { error: "Model JSON did not match the expected shape" },
            { status: 502 },
          );
        }
        const structured: ChatActionResponse = {
          ...shaped.data,
          mode: payload.action,
          scope: payload.scope,
        };
        setTraceIO({
          input: { chatAction: payload, userMessage: chatAction.userMessage },
          output: structured,
        });
        posthogLog.info("Workshop AI action completed", {
          route: "/api/chat",
          action: payload.action,
          scope: payload.scope,
        });
        return NextResponse.json(structured, {
          headers: {
            "Cache-Control": "no-store",
            "X-Chat-Mode": "fast",
            "X-Chat-Response-Kind": "action",
          },
        });
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "OPENAI_API_KEY is not set") {
      return NextResponse.json(
        { error: "Server is not configured with OPENAI_API_KEY" },
        { status: 503 },
      );
    }
    console.error("[chat-action]", message);
    return NextResponse.json({ error: "Workshop failed" }, { status: 500 });
  }
}
