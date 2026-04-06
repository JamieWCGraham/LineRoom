import { NextResponse } from "next/server";
import {
  runWithLangfuseTrace,
  scheduleLangfuseFlush,
} from "@/lib/langfuse-server";
import { createBaseOpenAI, getChatModel } from "@/lib/openai";
import {
  buildCritiqueUserPayload,
  CRITIQUE_JSON_INSTRUCTIONS,
} from "@/lib/prompts";
import { critiqueRequestSchema, critiqueResultSchema } from "@/lib/validators";

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

  scheduleLangfuseFlush();

  const payload = parsed.data;
  const userContent = buildCritiqueUserPayload(payload);

  try {
    return await runWithLangfuseTrace(
      {
        traceName: "LineRoom",
        rootObservationName: "lineroom-critique",
        tags: ["lineroom", "critique"],
        langfuseConfig: {
          traceName: "LineRoom",
          generationName: "lyric-critique",
          tags: ["lineroom", "critique"],
        },
      },
      async ({ createTracedOpenAI, setTraceIO }) => {
        const openai = createTracedOpenAI(createBaseOpenAI());
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CRITIQUE_JSON_INSTRUCTIONS },
            { role: "user", content: userContent },
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
          json = JSON.parse(raw) as unknown;
        } catch {
          return NextResponse.json(
            { error: "Model returned invalid JSON" },
            { status: 502 },
          );
        }

        const validated = critiqueResultSchema.safeParse(json);
        if (!validated.success) {
          return NextResponse.json(
            { error: "Critique shape validation failed" },
            { status: 502 },
          );
        }

        setTraceIO({
          input: { messages: payload },
          output: validated.data,
        });
        return NextResponse.json({ critique: validated.data });
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
    console.error("[critique]", message);
    return NextResponse.json({ error: "Critique failed" }, { status: 500 });
  }
}
