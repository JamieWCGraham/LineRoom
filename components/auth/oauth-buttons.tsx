"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildOAuthSignInOptions } from "@/lib/auth/oauth";

type OAuthProvider = "google" | "github";

const DEFAULT_PROVIDERS: readonly OAuthProvider[] = ["google", "github"];

export function OAuthButtons({
  providers = DEFAULT_PROVIDERS,
}: {
  providers?: readonly OAuthProvider[];
}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  async function signIn(provider: OAuthProvider) {
    setPending(provider);
    try {
      const supabase = createClient();
      const built = buildOAuthSignInOptions(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: built.provider,
        options: built.options,
      });
      if (error) console.error(error.message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.includes("google") ? (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => signIn("google")}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      ) : null}
      {providers.includes("github") ? (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => signIn("github")}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
      ) : null}
    </div>
  );
}
