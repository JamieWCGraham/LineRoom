import { NextResponse } from "next/server";
import { getChatModel, getOpenAI } from "@/lib/openai";
import { buildCritiqueUserPrompt, CRITIQUE_SYSTEM } from "@/lib/prompts";
import { getSurroundingContext } from "@/lib/text";
import {
  critiqueRequestSchema,
  critiqueResponseSchema,
} from "@/lib/validators";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = critiqueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    fullText,
    selectedText,
    voiceNotes,
    contextBefore: bodyBefore,
    contextAfter: bodyAfter,
  } = parsed.data;

  const computed = getSurroundingContext(fullText, selectedText);
  const contextBefore =
    bodyBefore && bodyBefore.length > 0 ? bodyBefore : computed.contextBefore;
  const contextAfter =
    bodyAfter && bodyAfter.length > 0 ? bodyAfter : computed.contextAfter;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: CRITIQUE_SYSTEM },
        {
          role: "user",
          content: buildCritiqueUserPrompt({
            fullText,
            selectedText,
            contextBefore,
            contextAfter,
            voiceNotes: voiceNotes ?? "",
          }),
        },
      ],
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

    const out = critiqueResponseSchema.safeParse(json);
    if (!out.success) {
      return NextResponse.json(
        { error: "Response shape invalid", details: out.error.flatten() },
        { status: 502 },
      );
    }

    return NextResponse.json(out.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "OPENAI_API_KEY is not set") {
      return NextResponse.json(
        { error: "Server is not configured with OPENAI_API_KEY" },
        { status: 503 },
      );
    }
    console.error("[critique]", message);
    return NextResponse.json({ error: "Critique failed" }, { status: 500 });
  }
}
