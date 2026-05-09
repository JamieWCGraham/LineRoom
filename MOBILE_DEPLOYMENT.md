You’re already most of the way there for **iOS**. `LineRoom` is set up as a **Capacitor remote-web shell** around your hosted Next app, which is the right approach for your current architecture.

## Where You Are Right Now

- `LineRoom` is a Next.js full-stack app (`app/api/*`, middleware, server secrets), so shipping as a static mobile bundle is not the right path.
- Capacitor is already installed and scripted in `package.json` (`cap:sync`, `cap:open`).
- iOS wrapper is already present (`ios/` exists).
- `capacitor.config.ts` is configured for a remote URL model and `ios/App/App/capacitor.config.json` currently points to `https://line-room.com`.
- **In-app purchases (iOS)**: LineRoom Pro uses **StoreKit** inside the Capacitor shell (`capacitor-plugin-cdv-purchase`). Stripe checkout/portal is **blocked** in the iOS WebView (client header + API guards). Web browsers continue to use Stripe.
- Android project is **not** created yet (`android/` folder not found).

## Publish Path (iOS)

1. **Lock production web backend first**
   - Ensure your deployed web app is healthy (likely Vercel) with all required env vars (`OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, Supabase/Stripe config).

2. **Finalize Capacitor target URL**
   - For release, make sure `server.url` points to your canonical production origin.
   - Keep HTTPS only for production (`cleartext: false`).

3. **Sync native project**
   - From `Experiments/LineRoom`:
     - **Release (recommended)**: `LINE_ROOM_CAP_ENV_FILE=/path/to/.env.production.local npm run cap:sync:ios:production` — loads env then runs `cap sync ios` so `CAPACITOR_SERVER_URL` and `CAPACITOR_ALLOW_NAVIGATION` are baked into `ios/App/App/capacitor.config.json`.
     - **Dev**: `npm run cap:sync` then `npm run cap:open`
   - This updates and opens the Xcode project.

### Redirect host inventory (`CAPACITOR_ALLOW_NAVIGATION`)

Keep this comma-separated list in sync with **Supabase Auth redirect allowlists** and any hosts your flows open in the WebView. Include at least:

- Your production app host (e.g. `line-room.com`, `*.line-room.com` if you use subdomains).
- Supabase hosted auth: `*.supabase.co` (or your custom auth host if configured).
- Stripe: `*.stripe.com`, `checkout.stripe.com`, `billing.stripe.com` (only needed if you still open Stripe in WebView on other platforms; iOS app blocks Stripe for Pro).
- OAuth IdPs you use (examples: `accounts.google.com`, `appleid.apple.com`, `login.microsoftonline.com`).

Example:

`CAPACITOR_ALLOW_NAVIGATION=line-room.com,*.supabase.co,*.stripe.com,accounts.google.com,appleid.apple.com`

### Apple IAP & server env (Vercel / hosting)

Set on the **Next** deployment (not only locally):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_IOS_IAP_PRODUCT_ID` | Auto-renewable subscription product id from App Store Connect (must match the native product). |
| `IOS_IAP_PRODUCT_ID` | Optional server-only mirror for validation. |
| `APPLE_BUNDLE_ID` | Defaults to `com.phasespace.lineroom` if unset. |
| `APPLE_IAP_ENVIRONMENT` | `sandbox` or `production` — must match the transactions you verify. |
| `APPLE_APP_STORE_APP_ID` | **Required in production** for Apple’s `SignedDataVerifier` (numeric App ID from App Store Connect). |
| `APPLE_IAP_ONLINE_CERT_CHECKS` | Set to `false` to skip online cert revocation checks (use only if your host cannot reach Apple OCSP reliably). |
| `APP_STORE_NOTIFICATION_AUTH_SECRET` | Optional Bearer secret; if set, ASN POST must send `Authorization: Bearer <secret>`. |

**Apple root certificates** for JWS verification live in `certs/apple/` (`AppleRootCA-G3.cer`, `AppleIncRootCertificate.cer`). Re-fetch from [Apple PKI](https://www.apple.com/certificateauthority/) if you rotate them.

**App Store Server Notifications v2** URL (configure in App Store Connect):

`https://<your-production-host>/api/billing/ios/app-store-notifications`

### Account deletion (App Store Guideline 5.1.1(v))

The Account page includes **Delete account** (email confirmation). `POST /api/account/delete` cancels an active **Stripe** subscription when applicable, then removes the Supabase auth user (cascades per your schema).

4. **Configure iOS app metadata/signing in Xcode**
   - Open `ios/App/App.xcworkspace` in Xcode (or run `npm run cap:open`).
   - In the Project navigator, click the blue **App** project icon, then select the **App** target.
   - In **Signing & Capabilities**:
     - Set **Team** to your Apple Developer team.
     - Set **Bundle Identifier** (reverse-DNS, unique), for example `com.yourcompany.lineroom`.
     - Keep **Automatically manage signing** enabled unless you use manual profiles.
     - Confirm **Signing Certificate** is valid (Apple Development for debug, Apple Distribution for release).
     - If you use manual signing, select the correct provisioning profile for each build configuration.
   - In **General**:
     - Set **Display Name** (what users see on Home Screen).
     - Set **Version** (`CFBundleShortVersionString`, e.g. `1.0.0`).
     - Set **Build** (`CFBundleVersion`, e.g. `1`, increment every upload).
   - App icon:
     - In Project navigator, open `App/Assets.xcassets` and select **AppIcon**.
     - Drag required icon sizes or use a generated full icon set.
     - Ensure no empty required slots before archiving.
   - Launch screen:
     - Open `App/Base.lproj/LaunchScreen.storyboard`.
     - Keep it simple/static (logo + background color), no loading indicators or dynamic text.
     - Make sure constraints are valid for all device sizes.
   - Microphone permission text (`NSMicrophoneUsageDescription`):
     - Open `App/App/Info.plist`.
     - Add key **Privacy - Microphone Usage Description** (`NSMicrophoneUsageDescription`).
     - Set clear user-facing text, for example:
       - "LineRoom needs microphone access so you can record speaking responses for feedback."
     - If this key is missing and recording is triggered, iOS can terminate the app.

5. **Test on real device (not just simulator)**
   - Verify auth/session persistence (Supabase cookies in `WKWebView`).
   - Verify chat/critique API routes.
   - Verify billing flows/redirects.
   - Verify record → upload path for draft recordings.

6. **TestFlight rollout**
   - Archive in Xcode and upload to App Store Connect.
   - Start with internal testers, then external testers.
   - Fix any App Review/TestFlight issues.

7. **Submit to App Store**
   - Complete privacy labels and app metadata.
   - Submit for review.

## Critical Gotchas Before Submission

- **IAP products**: Create the auto-renewable subscription in App Store Connect and set `NEXT_PUBLIC_IOS_IAP_PRODUCT_ID` before shipping; then archive with a synced iOS project.
- **Stripe in the iOS app**: Do not re-enable Stripe checkout for Pro in the shell without a legal/App Review plan — the app and API are intentionally split (IAP on iOS, Stripe in browser).
- **Redirect / cookies**: Supabase Site URL, redirect allowlist, and `server.url` must share one canonical HTTPS origin.
- **Node version for Capacitor CLI**: the repo allows Node `>=20`, but Capacitor 8 CLI is happiest on Node 22+ for `cap sync`.