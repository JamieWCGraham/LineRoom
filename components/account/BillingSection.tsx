"use client";

import { useCallback, useState } from "react";
import type { CritiqueAccessState } from "@/lib/billing/types";

type Props = {
  initialAccess: CritiqueAccessState;
};

export function BillingSection({ initialAccess }: Props) {
  const [access, setAccess] = useState(initialAccess);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/access");
      const data = (await res.json()) as { access?: CritiqueAccessState };
      if (data.access) setAccess(data.access);
    } catch {
      /* ignore */
    }
  }, []);

  const planLabel =
    access.isBypassed || access.hasActiveSubscription ? "LineRoom Pro"
    : access.reason === "unauthenticated" ? "—"
    : "Free";

  async function upgrade() {
    setMessage(null);
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        bypassed?: boolean;
        subscribed?: boolean;
        message?: string;
      };
      if (data.bypassed || data.subscribed) {
        setMessage(data.message ?? "You already have access.");
        await refetch();
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Could not start checkout.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage("No checkout URL returned.");
    } catch {
      setMessage("Network error.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function openPortal() {
    setMessage(null);
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not open billing portal.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage("No portal URL returned.");
    } catch {
      setMessage("Network error.");
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/20 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Billing
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Current plan</dt>
          <dd className="text-right font-medium text-zinc-200">{planLabel}</dd>
        </div>
        {!access.isBypassed && !access.hasActiveSubscription ?
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Free critiques left</dt>
            <dd className="text-right text-zinc-200">
              {access.remainingFreeCritiques} of {access.freeQuota}
            </dd>
          </div>
        : null}
        {access.hasActiveSubscription && access.currentPeriodEnd ?
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Renews / ends</dt>
            <dd className="text-right text-zinc-300">
              {new Date(access.currentPeriodEnd).toLocaleDateString()}
            </dd>
          </div>
        : null}
      </dl>
      {message ?
        <p className="mt-3 text-sm text-amber-200/90">{message}</p>
      : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {!access.isBypassed && !access.hasActiveSubscription ?
          <button
            type="button"
            onClick={() => void upgrade()}
            disabled={checkoutBusy}
            className="rounded-lg bg-amber-700/90 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-600 disabled:opacity-50"
          >
            {checkoutBusy ? "Loading…" : "Upgrade to Pro"}
          </button>
        : null}
        {access.hasActiveSubscription ?
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={portalBusy}
            className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/60 disabled:opacity-50"
          >
            {portalBusy ? "Loading…" : "Manage billing"}
          </button>
        : null}
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg px-4 py-2 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          Refresh status
        </button>
      </div>
    </section>
  );
}
