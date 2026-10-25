import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  OAUTH_NEXT_COOKIE,
  buildOAuthSignInOptions,
  getSiteUrl,
  parseOAuthProvider,
  sanitizeAuthNext,
} from "@/lib/auth/oauth";

function applyOAuthNextCookie(
  res: NextResponse,
  next: string,
  site: string,
): void {
  if (next !== "/") {
    res.cookies.set(OAUTH_NEXT_COOKIE, next, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: site.startsWith("https://"),
      maxAge: 600,
    });
  } else {
    res.cookies.set(OAUTH_NEXT_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
  }
}

/**
 * Starts Supabase OAuth (Google / Apple). PKCE cookies are set on this response
 * before redirecting to the IdP — keep initiation on the server with the SSR client.
 *
 * `native=1` (Capacitor iOS): returns JSON `{ url }` with custom-scheme redirectTo
 * so the client can open ASWebAuthenticationSession; PKCE cookies stay on the WebView.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(requestUrl.searchParams.get("provider"));
  const next = sanitizeAuthNext(requestUrl.searchParams.get("next"));
  const native = requestUrl.searchParams.get("native") === "1";
  const wantsJson =
    native ||
    request.headers.get("accept")?.includes("application/json") === true;
  const site = getSiteUrl();

  if (!provider) {
    if (wantsJson) {
      return NextResponse.json(
        { error: "oauth_provider" },
        { status: 400 },
      );
    }
    return NextResponse.redirect(
      new URL("/login?error=oauth_provider", site),
    );
  }

  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  const oauthOpts = buildOAuthSignInOptions(provider, { native });
  const { data, error } =
    existingUser?.is_anonymous ?
      await supabase.auth.linkIdentity(oauthOpts)
    : await supabase.auth.signInWithOAuth(oauthOpts);

  if (error || !data.url) {
    if (wantsJson) {
      return NextResponse.json(
        { error: "oauth_callback" },
        { status: 502 },
      );
    }
    return NextResponse.redirect(
      new URL("/login?error=oauth_callback", site),
    );
  }

  if (wantsJson) {
    const res = NextResponse.json({ url: data.url });
    applyOAuthNextCookie(res, next, site);
    return res;
  }

  const res = NextResponse.redirect(data.url);
  applyOAuthNextCookie(res, next, site);
  return res;
}
