"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensureCurrentUserProfile } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

type Props = {
  children: ReactNode;
};

/**
 * Ensures a Supabase session before mounting the local editor.
 * Creates an anonymous guest session when none exists.
 */
export function GuestSessionGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          const { error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) {
            if (!cancelled) {
              setError(
                anonError.message ||
                  "Could not start a guest session. Enable Anonymous sign-ins in Supabase Auth.",
              );
            }
            return;
          }
        }

        const profileResult = await ensureCurrentUserProfile();
        if (!profileResult.ok && !cancelled) {
          console.warn("[guest] ensureCurrentUserProfile", profileResult.error);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.is_anonymous) {
          track("trial_started", { plan: "free", source: "lineroom" });
        }

        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Guest session failed.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <p className="max-w-md text-sm text-rose-300" role="alert">
          {error}
        </p>
        <a
          href="/signup"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Sign up instead
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading New LineRoom Session…
      </div>
    );
  }

  return <>{children}</>;
}
