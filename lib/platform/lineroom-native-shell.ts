/**
 * Embedded in the iOS WebView user agent via `ios.appendUserAgent` in
 * `capacitor.config.ts`. Run `npx cap sync ios` after changing this string.
 *
 * Used client-side (billing / IAP) and server-side (Stripe routes) so the
 * installed app cannot fall through to Stripe when JS-only detection fails.
 */
export const LINEROOM_IOS_SHELL_UA_TOKEN = "LineRoomNativeShell/iOS";

export function userAgentHasLineroomIosShellToken(ua: string | null | undefined): boolean {
  const s = ua?.trim() ?? "";
  return s.length > 0 && s.includes(LINEROOM_IOS_SHELL_UA_TOKEN);
}
