# LineRoom

Lyric workspace: **draft** and **Workshop** for the full draft (“talk to your lyrics”).

This MVP is a **Next.js** app meant to deploy on **Vercel** with **serverless API routes**, **client-side state**, and **localStorage** autosave.

## Features

- Two-column layout on desktop (draft, Workshop); stacks on small screens.
- Main **draft** editor.
- **Workshop your lyrics** — conversational panel backed by `POST /api/chat` (full draft injected each turn so edits stay in sync).
- Autosave: draft and Workshop history in `localStorage`.

## Setup

```bash
cd Experiments/LineRoom
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY (Workshop) and AI_GATEWAY_API_KEY (generate critique) in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `OPENAI_API_KEY`       | Yes      | Server-only; `/api/chat`. Never exposed to the client. |
| `AI_GATEWAY_API_KEY`   | Yes      | Server-only; `/api/critique` via [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/openai-compat). |
| `CRITIQUE_LLM_PROVIDER`| No       | `openai` (default) → gateway `openai/gpt-5-mini`, or `gemini` → `google/gemini-3.1-pro-preview`. Override fully with `CRITIQUE_GATEWAY_MODEL`. |
| `OPENAI_MODEL`         | No       | Workshop default; see `lib/openai.ts`. |
| `LANGFUSE_SECRET_KEY`  | No       | Enables [Langfuse](https://langfuse.com) tracing when set with `LANGFUSE_PUBLIC_KEY`. |
| `LANGFUSE_PUBLIC_KEY`  | No       | Pair with secret key for Langfuse. |
| `LANGFUSE_BASE_URL`    | No       | Defaults to `https://cloud.langfuse.com` (EU). US: `https://us.cloud.langfuse.com`. |

### Langfuse

When both Langfuse keys are set, OpenAI calls from `/api/chat` are wrapped with [`observeOpenAI`](https://langfuse.com/docs/integrations/openai/js/get-started) and exported via OpenTelemetry (`LangfuseSpanProcessor`, `exportMode: "immediate"`). Each route schedules `after(() => forceFlush())` so traces flush on Vercel serverless. Without keys, behavior is unchanged and no Langfuse code paths run.

Requires **Node.js 20+** (for `@langfuse/otel`). Set the same variables in Vercel for production traces.

## Deploy on Vercel

1. Import the repo (or this folder as the project root).
2. Add `OPENAI_API_KEY` and `AI_GATEWAY_API_KEY` in **Project → Settings → Environment Variables** (see table above).
3. Deploy. No database or extra services required for this MVP.

## Project layout

- `app/page.tsx` — client UI and state.
- `app/api/chat/route.ts` — Workshop route handler.
- `instrumentation.ts` — registers Langfuse OpenTelemetry on the Node runtime when configured.
- `lib/langfuse-server.ts` — Langfuse span processor, `observeOpenAI` wrapper, `after` flush for serverless.
- `components/` — `DraftEditor`, `LyricChatPanel`, `Header`.
- `lib/` — types, Zod validators, prompts, OpenAI client.

## Non-goals (MVP)

Auth, billing, cloud project storage, DAW integration, rhyme/scan engines, and full-song generation modes are out of scope for this version but will be included later.
