import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  OAUTH_NEXT_COOKIE,
  buildOAuthSignInOptions,
  getSiteUrl,
  parseOAuthProvider,
  sanitizeAuthNext,
} from "@/lib/auth/oauth";

/**
 * Starts Supabase OAuth (Google / Apple). PKCE cookies are set on this response
 * before redirecting to the IdP — keep initiation on the server with the SSR client.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(requestUrl.searchParams.get("provider"));
  const next = sanitizeAuthNext(requestUrl.searchParams.get("next"));
  const site = getSiteUrl();

  if (!provider) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_provider", site),
    );
  }

  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  const oauthOpts = buildOAuthSignInOptions(provider);
  const { data, error } =
    existingUser?.is_anonymous ?
      await supabase.auth.linkIdentity(oauthOpts)
    : await supabase.auth.signInWithOAuth(oauthOpts);

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_callback", site),
    );
  }

  const res = NextResponse.redirect(data.url);
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

  return res;
}
