# Contributing to LineRoom

## Before opening a PR

```bash
cd Experiments/LineRoom
npm ci
npm run lint
npm test
npm run build
npm run test:e2e   # optional locally; requires E2E_TEST_EMAIL/PASSWORD for auth flows
```

## PR checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No prompt text changes unless the PR is explicitly about prompts
- [ ] New logic in `lib/` has unit tests where behavior is non-trivial
- [ ] Editor/song changes: manual QA on local (`/lineroom`) and song version save/switch/new/delete

## E2E

Install the browser once (required after `npm install` or Playwright upgrades):

```bash
npm run playwright:install
# or: npx playwright install chromium
```

If you still see `Executable doesn't exist` under `~/Library/Caches/ms-playwright/`, clear the broken cache and reinstall:

```bash
rm -rf ~/Library/Caches/ms-playwright/chromium_headless_shell-*
npm run playwright:install
```

Copy `.env.test.example` to `.env.test.local` and set `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for authenticated smoke tests. Without credentials, only unauthenticated tests run in CI.

LLM routes are stubbed in Playwright by default (`e2e/helpers/stub-llm-routes.ts`).

## Module boundaries

See [ARCHITECTURE.md](ARCHITECTURE.md).
