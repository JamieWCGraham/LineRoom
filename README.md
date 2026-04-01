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

| Variable         | Required | Description                          |
|------------------|----------|--------------------------------------|
| `OPENAI_API_KEY` | Yes      | Server-only; never exposed to the client. |
| `OPENAI_MODEL`   | No       | Defaults to `gpt-4o-mini`.           |

## Deploy on Vercel

1. Import the repo (or this folder as the project root).
2. Add `OPENAI_API_KEY` in **Project → Settings → Environment Variables**.
3. Deploy. No database or extra services required for this MVP.

## Project layout

- `app/page.tsx` — client UI and state.
- `app/api/rewrite/route.ts`, `app/api/critique/route.ts` — route handlers.
- `components/` — `DraftEditor`, `ActionPanel`, `SuggestionCard`, `CritiquePanel`, `Header`.
- `lib/` — types, Zod validators, prompts, OpenAI client, text helpers.

## Non-goals (MVP)

Auth, billing, cloud project storage, DAW integration, rhyme/scan engines, and full-song generation modes are out of scope for this version.
