# Cursor Spec: LineRoom + Capacitor (iOS)

## Goal

Ship LineRoom as an **iOS app** by wrapping the existing web app with **Capacitor**, without rewriting the product as a static SPA. The app must support auth, API routes, billing flows, chat/critique, and draft audio recording.

## Non-goals (initial phase)

- Android (can follow the same spec later).
- Offline-first or bundling the full Next server inside the app.

## Billing (locked for App Store)

- **iOS (Capacitor WebView)**: LineRoom Pro is sold with **StoreKit / IAP** (`capacitor-plugin-cdv-purchase`). Stripe checkout and the Stripe customer portal are **not** offered in-app.
- **Web (browser)**: Stripe checkout and webhooks remain the path for Pro subscriptions.

## Architecture decision (required)

LineRoom is a **full-stack Next.js app**: `middleware.ts` (Supabase session refresh), many **`app/api/**/route.ts`** handlers, and server-only secrets. **Static export (`output: 'export'`) is not viable** without a large backend split.

**Recommended approach:** **Remote URL shell**

- Capacitor’s iOS app loads the **deployed production origin** (e.g. `https://app.yourdomain.com`) inside `WKWebView` via Capacitor server config (`server.url`), **or** uses a **local dev URL** only for internal builds.
- Native project exists for App Store packaging, splash, icons, permissions, and optional native plugins later.

**Alternative (only if explicitly chosen):** Self-hosted Next + tunnel or bundled Node — high operational cost; not the default.

## Prerequisites

- **Node.js 22+** when running Capacitor CLI (`npx cap`, `npm run cap:sync`); `@capacitor/cli` 8.x declares this engine. The Next.js app may still run on Node 20 for web-only work.
- macOS with **Xcode** (current stable). Capacitor 8 for iOS uses **Swift Package Manager** by default (no `pod install` required unless you add CocoaPods-based plugins).
- Apple Developer account for device testing and distribution.
- Production deployment already working in a browser (Vercel or similar) with correct `NEXT_PUBLIC_*` and Supabase redirect URLs.

## Implementation phases

### Phase 1 — Capacitor bootstrap

1. Add dev dependencies: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` (pin versions consistent with Capacitor docs for your chosen major version).
2. Run `npx cap init` with:
   - **App name** and **App ID** (reverse-DNS, e.g. `com.phasespace.lineroom`).
   - **Web dir**: document the chosen strategy:
     - **Remote URL**: web dir can be a minimal placeholder; the **authoritative** load target is `server.url` in `capacitor.config.*`.
3. Add npm scripts, for example:
   - `cap:sync` → `cap sync ios`
   - `cap:open` → `cap open ios`
4. Generate `ios/` with `npx cap add ios` and open the workspace in Xcode.

**Cursor constraints:** Do not change Next `output` to `export` unless a separate epic explicitly migrates all server behavior to external APIs.

### Phase 2 — Capacitor configuration

1. **`capacitor.config.ts` (or `.json`)**
   - Set `server.url` to production base URL for release builds (or env-driven).
   - Consider `server.cleartext: true` **only** for local dev HTTP; **false** for production.
   - Set `ios.contentInset` / safe-area behavior if the UI sits under the notch (verify against real device).
2. **`allowNavigation` / `hostname`**
   - Allow your production domain (and any auth/OAuth/stripe redirect hosts you use).
3. **Deep links (optional but recommended)**
   - Register a **custom URL scheme** or **Universal Links** if you need magic links or Stripe return URLs to reopen the app; align with `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` and Supabase redirect allowlist.

### Phase 3 — iOS permissions and Info.plist

1. **Microphone** — Draft recordings use `navigator.mediaDevices.getUserMedia` and `MediaRecorder` (`DraftRecordingsPanel.tsx`). Add **`NSMicrophoneUsageDescription`** with a clear user-facing string.
2. If you add camera or photo library later, add the matching usage keys before calling those APIs.
3. **ATS (App Transport Security)** — Production must use **HTTPS**. Avoid blanket ATS exceptions; fix server TLS instead.

### Phase 4 — Auth and cookies (Supabase)

1. Confirm **cookie-based session** behavior in `WKWebView` (SameSite, Secure, domain). Supabase SSR + middleware must still run on the **same origin** as the loaded URL (your deployed site), not a mismatched `localhost` unless dev-only.
2. In **Supabase Dashboard → Authentication → URL configuration**, add:
   - Production site URL.
   - Redirect URLs for OAuth / email links that must return to the app (custom scheme or universal link as chosen).
3. Update `.env.example` documentation: for mobile, `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` must reflect the **canonical user-facing origin** used for redirects and Stripe return URLs.

### Phase 5 — Payments and external flows

1. **iOS**: IAP product id via `NEXT_PUBLIC_IOS_IAP_PRODUCT_ID`; server verifies StoreKit 2 JWS (`/api/billing/ios/plugin-validator`) and optional ASN v2 (`/api/billing/ios/app-store-notifications`). See `MOBILE_DEPLOYMENT.md`.
2. **Web**: Stripe Checkout / Customer Portal unchanged in the browser.
3. **Guideline 3.1.1**: the binary must not send users to Stripe for the same digital Pro entitlement; platform detection uses Capacitor + `x-lineroom-client-platform` on billing API calls.

### Phase 6 — Media / uploads

1. Exercise **draft recording** upload path on device (Supabase signed URLs from `/api/draft-recordings/*`).
2. If any CORS or cookie issues appear, fix at API/storage config rather than disabling security.

### Phase 7 — Release hygiene

1. App icons, launch screen, display name, version/build bump process.
2. **Privacy Nutrition Labels** — microphone; any analytics (e.g. Langfuse if used client-side—verify); third-party SDKs.
3. TestFlight internal → external testing before App Store submission.

## Acceptance criteria

- [ ] iOS app installs on device and loads the **production** LineRoom URL without mixed-content or ATS failures.
- [ ] Sign-in/session persists across app restarts (cookie/session behavior verified).
- [ ] Core flows work: song editor navigation, chat/critique (API routes), billing pages as currently designed.
- [ ] Draft recording: permission prompt appears; record/stop/upload succeeds.
- [ ] No regression to `next dev` / `next build` web workflows; Capacitor files are isolated (`ios/`, `capacitor.config.*`, npm scripts).

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| OAuth opens Safari and doesn’t return to app | Universal Links or custom URL scheme + Supabase redirect allowlist |
| Cookies not persisted in WebView | Same-site/secure flags; same origin as configured `server.url` |
| App Review / IAP for subscriptions | Product/legal plan; possibly “reader” or web-only account model |
| `localhost` in env on device | Never point `server.url` at dev machine without tunnel and cleartext rules |

## Files likely touched (for implementer)

- `package.json` (Capacitor deps + scripts)
- `capacitor.config.ts` / `capacitor.config.json`
- `ios/**` (Xcode project, `Info.plist`, assets)
- Documentation only: `.env.example` notes for mobile URLs (if you choose to update docs in Agent mode)

## Verification commands (implementer)

- `npm run build` (web unchanged)
- `npx cap sync ios` after config changes
- Xcode: Run on simulator and physical device

---

**Summary:** Treat Capacitor as a **native container around your hosted Next app**, not a static export. That preserves middleware, API routes, and Supabase SSR with the smallest surface area; add iOS microphone permission and tighten auth/redirect URLs for real devices.
