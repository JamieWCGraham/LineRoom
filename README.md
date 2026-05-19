# LineRoom

Lyric workspace: **draft**, **Workshop** (chat), **critique**, voice memos, and cloud-saved **pieces** with version history.

Built with **Next.js 15**, **Supabase** (auth + Postgres + storage), **Stripe** and **iOS IAP** billing, and **Capacitor** for the iOS shell.

## Features

- **Dashboard** — create and open pieces; multiple saved versions per piece.
- **Editor** — draft + brainstorm panes, workshop chat, AI critique, draft recordings (local or cloud).
- **Billing** — LineRoom Pro (Stripe web, StoreKit iOS); free-tier critique quota.
- **Evals** (internal) — batch critique evaluation, metrics, HITL ground truth — see `app/evals/EVAL_ARCHITECTURE.md`.

## Setup

```bash
cd Experiments/LineRoom
npm install
cp .env.example .env.local
# Configure Supabase, OPENAI_API_KEY, AI_GATEWAY_API_KEY, Stripe, etc.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Vitest with coverage thresholds |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run lint` | ESLint |

## Environment

See [.env.example](.env.example) for the full list. Minimum for local dev:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server routes, webhooks)
- `OPENAI_API_KEY` (Workshop `/api/chat`)
- `AI_GATEWAY_API_KEY` (Critique `/api/critique`)

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploy

Deploy on **Vercel** with env vars from `.env.example`. Apply Supabase migrations from `supabase/migrations/`. For iOS, see [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md).

## Docs

- [docs/CRITIQUE.md](docs/CRITIQUE.md) — critique LLM pipeline
- [app/evals/EVAL_ARCHITECTURE.md](app/evals/EVAL_ARCHITECTURE.md) — eval system
