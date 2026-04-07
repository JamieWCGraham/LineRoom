import { NextResponse } from "next/server";
import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import { createBaseOpenAI, getChatModel } from "@/lib/openai";
import { buildLyricChatSystemPrompt } from "@/lib/prompts";
import type { CritiqueMeta, CritiqueResult } from "@/lib/types";
import { chatRequestSchema } from "@/lib/validators";

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
    .map((l) => `Line: ${l.quotedLine}\nNote: ${l.feedback}`)
    .join("\n\n");
  const subscores = Object.entries(critique.subscores)
    .map(([dimension, score]) => `- ${dimension}: ${score}/5`)
    .join("\n");
  return `${header}
Overall rating band: ${critique.overallRatingBand}
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

export async function POST(req: Request) {
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

  const { fullText, pieceTitle, messages, critique, critiqueMeta } =
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

  const critiqueBlock = formatCritiqueForChat(
    critique,
    critiqueMeta,
    pieceTitle,
  );

  const openaiMessages = [
    {
      role: "system" as const,
      content: buildLyricChatSystemPrompt(fullText, critiqueBlock),
    },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    return await runWithLangfuseTrace(
      {
        traceName: "LineRoom",
        rootObservationName: "lineroom-chat",
        tags: ["lineroom", "chat"],
        langfuseConfig: {
          traceName: "LineRoom",
          generationName: "lyric-chat",
          tags: ["lineroom", "chat"],
        },
      },
      async ({ createTracedOpenAI, setTraceIO }) => {
        const openai = createTracedOpenAI(createBaseOpenAI());
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          messages: openaiMessages,
        });
        const reply = completion.choices[0]?.message?.content?.trim();
        if (!reply) {
          return NextResponse.json(
            { error: "Empty model response" },
            { status: 502 },
          );
        }

        setTraceIO({
          input: { messages: openaiMessages },
          output: { reply },
        });
        return NextResponse.json({ message: reply });
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
    console.error("[chat]", message);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
