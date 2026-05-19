# LineRoom architecture

## Layering

| Layer | Responsibility |
|-------|----------------|
| `app/` | Next.js routes, thin server pages, API route handlers |
| `components/` | React UI; orchestrators stay small, presentational pieces in subfolders |
| `lib/` | Business logic, validators, prompts, billing, critique, evals, Supabase helpers |
| `supabase/migrations/` | Schema, RLS, RPCs (e.g. critique quota) |
| `tests/` | Vitest unit/integration tests |
| `e2e/` | Playwright smoke tests (stubbed LLM routes by default) |

## Key flows

- **Critique**: `POST /api/critique` → `lib/critique/runCritiqueModel` → Zod (`lib/validators`) — see [docs/CRITIQUE.md](docs/CRITIQUE.md).
- **Workshop**: `POST /api/chat` → OpenAI + structured chat actions.
- **Song persist**: `lib/songs/persist` + `useSongPersist` debounced autosave with sub-revision conflict detection.
- **Billing**: Stripe + Apple IAP; access via `lib/billing/access`.
- **Evals**: `lib/evals/*` batch runner, judges, metrics; internal UI under `app/evals`.

## Editor module

- `components/LineRoomEditor.tsx` — entry (orchestrator).
- `lib/hooks/useLineRoomEditorState.tsx` — document state, persist, critique, version actions.
- `components/lineroom/LineRoomEditorLayout.tsx` — layout JSX.
- `components/lineroom/SongVersionBar.tsx` — version chrome.

## Conventions

- Validate all LLM JSON at boundaries with Zod.
- Keep table sort/filter logic in `lib/` (e.g. `lib/evals/ui`) and test it directly.
- Do not duplicate production helpers in tests; import from `lib/`.
