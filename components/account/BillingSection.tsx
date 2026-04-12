"use client";

import { useCallback, useState } from "react";
import type { CritiqueAccessState } from "@/lib/billing/types";

type Props = {
  initialAccess: CritiqueAccessState;
};

export function BillingSection({ initialAccess }: Props) {
  const [access, setAccess] = useState(initialAccess);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/access?sync=1");
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

  async function cancelSubscription() {
    setMessage(null);
    setCancelBusy(true);
    try {
      const res = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
      });
      const data = (await res.json()) as {
        canceled?: boolean;
        refunded?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Could not cancel subscription.");
        return;
      }
      setMessage(data.message ?? "Subscription canceled.");
      setConfirmingCancel(false);
      await refetch();
    } catch {
      setMessage("Network error.");
    } finally {
      setCancelBusy(false);
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
            <dt className="text-zinc-500">Current period ends</dt>
            <dd className="text-right text-zinc-300">
              {new Date(access.currentPeriodEnd).toLocaleDateString()}
            </dd>
          </div>
        : null}
      </dl>
      {message ?
        <p className="mt-3 text-sm text-amber-200/90">{message}</p>
      : null}

      {confirmingCancel ?
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-sm text-red-200">
            Your subscription will be canceled immediately and a refund will be
            issued for your most recent payment. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void cancelSubscription()}
              disabled={cancelBusy}
              className="rounded-lg bg-red-700/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {cancelBusy ? "Canceling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelBusy}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
            >
              Keep subscription
            </button>
          </div>
        </div>
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
        {access.hasActiveSubscription && !confirmingCancel ?
          <button
            type="button"
            onClick={() => { setMessage(null); setConfirmingCancel(true); }}
            className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-red-800 hover:bg-red-950/30 hover:text-red-200"
          >
            Cancel subscription
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
