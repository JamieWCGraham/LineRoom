import { NextResponse } from "next/server";
import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import { createBaseOpenAI, getChatModel } from "@/lib/openai";
import { buildRewriteUserPrompt, REWRITE_SYSTEM } from "@/lib/prompts";
import { getSurroundingContext } from "@/lib/text";
import {
  rewriteRequestSchema,
  rewriteResponseSchema,
} from "@/lib/validators";

const REWRITE_COUNT = 4;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = rewriteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    fullText,
    selectedText,
    action,
    customInstruction,
    voiceNotes,
    contextBefore: bodyBefore,
    contextAfter: bodyAfter,
  } = parsed.data;

  const computed = getSurroundingContext(fullText, selectedText);
  const contextBefore =
    bodyBefore && bodyBefore.length > 0 ? bodyBefore : computed.contextBefore;
  const contextAfter =
    bodyAfter && bodyAfter.length > 0 ? bodyAfter : computed.contextAfter;

  scheduleLangfuseFlush();

  const messages = [
    { role: "system" as const, content: REWRITE_SYSTEM },
    {
      role: "user" as const,
      content: buildRewriteUserPrompt({
        fullText,
        selectedText,
        contextBefore,
        contextAfter,
        voiceNotes: voiceNotes ?? "",
        action,
        customInstruction: customInstruction ?? "",
        n: REWRITE_COUNT,
      }),
    },
  ];

  try {
    return await runWithLangfuseTrace(
      {
        traceName: "LineRoom",
        rootObservationName: "lineroom-rewrite",
        tags: ["lineroom", "rewrite"],
        langfuseConfig: {
          traceName: "LineRoom",
          generationName: "lyric-rewrite",
          tags: ["lineroom", "rewrite"],
        },
      },
      async ({ createTracedOpenAI, setTraceIO }) => {
        const openai = createTracedOpenAI(createBaseOpenAI());
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          messages,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) {
          return NextResponse.json(
            { error: "Empty model response" },
            { status: 502 },
          );
        }

        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return NextResponse.json(
            { error: "Model returned invalid JSON" },
            { status: 502 },
          );
        }

        const out = rewriteResponseSchema.safeParse(json);
        if (!out.success) {
          return NextResponse.json(
            { error: "Response shape invalid", details: out.error.flatten() },
            { status: 502 },
          );
        }

        const options = out.data.options.slice(0, 5);
        setTraceIO({
          input: { messages },
          output: { options },
        });
        return NextResponse.json({ options });
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
    console.error("[rewrite]", message);
    return NextResponse.json({ error: "Rewrite failed" }, { status: 500 });
  }
}
