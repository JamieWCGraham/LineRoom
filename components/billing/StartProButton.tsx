"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { billingClientPlatformHeaders } from "@/lib/platform/capacitor-client";

/**
 * Same checkout entry the Account page uses: POST /api/billing/create-checkout-session.
 * Logged-out visitors are sent to sign up, then Account, where that button lives.
 */
export function StartProButton({
  source = "pricing_page",
  className,
}: {
  source?: "pricing_page" | "homepage";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    track("checkout_started", { plan: "pro", source });
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        window.location.href = "/signup?next=/account";
        return;
      }
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { ...billingClientPlatformHeaders() },
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        bypassed?: boolean;
        subscribed?: boolean;
      };
      if (res.status === 401) {
        window.location.href = "/signup?next=/account";
        return;
      }
      if (data.bypassed || data.subscribed || !data.url) {
        window.location.href = "/account";
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        data-checkout-source={source}
        className={
          className ??
          "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
        }
      >
        {busy ? "Loading…" : "Start Pro"}
      </button>
      {error ?
        <p className="mt-2 text-center text-xs text-rose-300" role="alert">
          {error}
        </p>
      : null}
    </div>
  );
}
