You’re already most of the way there for **iOS**. `LineRoom` is set up as a **Capacitor remote-web shell** around your hosted Next app, which is the right approach for your current architecture.

## Where You Are Right Now

- `LineRoom` is a Next.js full-stack app (`app/api/*`, middleware, server secrets), so shipping as a static mobile bundle is not the right path.
- Capacitor is already installed and scripted in `package.json` (`cap:sync`, `cap:open`).
- iOS wrapper is already present (`ios/` exists).
- `capacitor.config.ts` is configured for a remote URL model and `ios/App/App/capacitor.config.json` currently points to `https://line-room.com`.
- Android project is **not** created yet (`android/` folder not found).

## Publish Path (iOS)

1. **Lock production web backend first**
   - Ensure your deployed web app is healthy (likely Vercel) with all required env vars (`OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, Supabase/Stripe config).

2. **Finalize Capacitor target URL**
   - For release, make sure `server.url` points to your canonical production origin.
   - Keep HTTPS only for production (`cleartext: false`).

3. **Sync native project**
   - From `Experiments/LineRoom`:
     - `npm run cap:sync`
     - `npm run cap:open`
   - This updates and opens the Xcode project.

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

- **Apple IAP policy risk**: if your app sells digital features/subscriptions in-app via Stripe flow, App Review may require StoreKit IAP.
- **Redirect/deep-link consistency**: Supabase/Stripe return URLs must match your chosen app origin/deep-link strategy.
- **Node version for Capacitor CLI**: your codebase says Node `>=20`, but Capacitor 8 tooling is happiest on Node 22+ for CLI tasks.

If you want, I can give you a **pre-flight checklist you can run line-by-line in Xcode/App Store Connect** for this exact repo so you can go from “current state” to first TestFlight build in one pass.