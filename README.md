# LineRoom

Cursor-like lyric assistant: a focused AI editing partner (not a chatbot). This MVP is a **Next.js** app meant to deploy on **Vercel** with **serverless API routes**, **client-side state**, and **localStorage** autosave.

## Features

- Three-panel layout on desktop (draft, actions, suggestions + critique); stacks on small screens.
- Main draft editor plus a separate **Selected text** field (no dependency on native selection APIs).
- `POST /api/rewrite` — 3–5 structured options (label, rationale, text) for the chosen edit action.
- `POST /api/critique` — strengths, weaknesses, line callouts, cliché/emotional notes, next move.
- Apply flows: **Replace selection** (first exact match), **Insert below**, **Copy**; warning if the selection does not appear verbatim in the draft.
- **Regenerate** re-runs rewrite with the same inputs.
- Autosave: draft, voice notes, and selected text in `localStorage`.

## Setup

```bash
cd Experiments/LineRoom
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `OPENAI_API_KEY`       | Yes      | Server-only; never exposed to the client. |
| `OPENAI_MODEL`         | No       | Defaults to `gpt-4o-mini`. |
| `LANGFUSE_SECRET_KEY`  | No       | Enables [Langfuse](https://langfuse.com) tracing when set with `LANGFUSE_PUBLIC_KEY`. |
| `LANGFUSE_PUBLIC_KEY`  | No       | Pair with secret key for Langfuse. |
| `LANGFUSE_BASE_URL`    | No       | Defaults to `https://cloud.langfuse.com` (EU). US: `https://us.cloud.langfuse.com`. |

### Langfuse

When both Langfuse keys are set, OpenAI calls from `/api/rewrite` and `/api/critique` are wrapped with [`observeOpenAI`](https://langfuse.com/docs/integrations/openai/js/get-started) and exported via OpenTelemetry (`LangfuseSpanProcessor`, `exportMode: "immediate"`). Each route schedules `after(() => forceFlush())` so traces flush on Vercel serverless. Without keys, behavior is unchanged and no Langfuse code paths run.

Requires **Node.js 20+** (for `@langfuse/otel`). Set the same variables in Vercel for production traces.

## Deploy on Vercel

1. Import the repo (or this folder as the project root).
2. Add `OPENAI_API_KEY` in **Project → Settings → Environment Variables**.
3. Deploy. No database or extra services required for this MVP.

## Project layout

- `app/page.tsx` — client UI and state.
- `app/api/rewrite/route.ts`, `app/api/critique/route.ts` — route handlers.
- `instrumentation.ts` — registers Langfuse OpenTelemetry on the Node runtime when configured.
- `lib/langfuse-server.ts` — Langfuse span processor, `observeOpenAI` wrapper, `after` flush for serverless.
- `components/` — `DraftEditor`, `ActionPanel`, `SuggestionCard`, `CritiquePanel`, `Header`.
- `lib/` — types, Zod validators, prompts, OpenAI client, text helpers.

## Non-goals (MVP)

Auth, billing, cloud project storage, DAW integration, rhyme/scan engines, and full-song generation modes are out of scope for this version.
