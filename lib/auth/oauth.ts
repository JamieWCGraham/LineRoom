export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function oauthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

export function buildOAuthSignInOptions(provider: "google" | "github") {
  return {
    provider,
    options: {
      redirectTo: oauthCallbackUrl(),
    },
  } as const;
}
