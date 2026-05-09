"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { CritiqueAccessState } from "@/lib/billing/types";
import { IosAppStoreManageSubscription } from "@/components/billing/IosAppStoreManageSubscription";
import { IosProSubscription } from "@/components/billing/IosProSubscription";
import {
  billingClientPlatformHeaders,
  isIosCapacitorApp,
  useIosCapacitorAppLayout,
} from "@/lib/platform/capacitor-client";

type Props = {
  initialAccess: CritiqueAccessState;
};

export function BillingSection({ initialAccess }: Props) {
  const router = useRouter();
  const [access, setAccess] = useState(initialAccess);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const iosShell = useIosCapacitorAppLayout();

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/access?sync=1");
      const data = (await res.json()) as { access?: CritiqueAccessState };
      if (data.access) setAccess(data.access);
      router.refresh();
    } catch {
      /* ignore */
    }
  }, [router]);

  const planLabel =
    access.isBypassed || access.hasActiveSubscription ? "LineRoom Pro"
    : access.reason === "unauthenticated" ? "—"
    : "Free";

  async function upgrade() {
    if (isIosCapacitorApp()) {
      setMessage(
        "On iPhone, subscribe with the App Store section above. Stripe is not used inside this app.",
      );
      return;
    }
    setMessage(null);
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { ...billingClientPlatformHeaders() },
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
        if (isIosCapacitorApp()) {
          setMessage(
            "On iPhone, subscribe with the App Store section above. Stripe is not used inside this app.",
          );
          return;
        }
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
        headers: { ...billingClientPlatformHeaders() },
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

  const stripeCancelable =
    access.hasActiveSubscription &&
    access.subscriptionBillingProvider !== "app_store";

  const appStorePro =
    access.hasActiveSubscription &&
    access.subscriptionBillingProvider === "app_store" &&
    !access.isBypassed;

  return (
    <section>
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Billing
      </p>
      <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/80">
        <dl className="text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-700/60 px-4 py-3">
            <dt className="text-zinc-400">Current plan</dt>
            <dd className="text-right font-medium text-zinc-100">{planLabel}</dd>
          </div>
          {!access.isBypassed && !access.hasActiveSubscription ?
            <div className="flex items-center justify-between gap-4 border-b border-zinc-700/60 px-4 py-3">
              <dt className="text-zinc-400">Free critiques left</dt>
              <dd className="text-right text-zinc-200">
                {access.remainingFreeCritiques} of {access.freeQuota}
              </dd>
            </div>
          : null}
          {access.hasActiveSubscription && access.currentPeriodEnd ?
            <div className="flex items-center justify-between gap-4 border-b border-zinc-700/60 px-4 py-3">
              <dt className="text-zinc-400">Current period ends</dt>
              <dd className="text-right text-zinc-200">
                {new Date(access.currentPeriodEnd).toLocaleDateString()}
              </dd>
            </div>
          : null}
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => void refetch()}
              className="w-full rounded-lg border border-zinc-600/70 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              Refresh status
            </button>
          </div>
        </dl>
      </div>

      {appStorePro ?
        <p className="mt-2 px-1 text-xs leading-relaxed text-zinc-500">
          Billed through Apple. Use the button below to open subscription
          settings, or on the web use your Apple ID account page.
        </p>
      : null}
      {message ?
        <p className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200/90">
          {message}
        </p>
      : null}

      <IosProSubscription
        hasActiveSubscription={access.hasActiveSubscription}
        isBypassed={access.isBypassed}
        onEntitlementUpdated={() => void refetch()}
      />

      {confirmingCancel ?
        <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-sm text-red-200">
            Your subscription will be canceled immediately and a refund will be
            issued for your most recent payment.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void cancelSubscription()}
              disabled={cancelBusy}
              className="rounded-xl bg-red-700/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {cancelBusy ? "Canceling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelBusy}
              className="rounded-xl px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
            >
              Keep subscription
            </button>
          </div>
        </div>
      : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {!access.isBypassed && !access.hasActiveSubscription && !iosShell ?
          <button
            type="button"
            onClick={() => void upgrade()}
            disabled={checkoutBusy}
            className="rounded-xl bg-emerald-700/90 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {checkoutBusy ? "Loading…" : "Upgrade to Pro (web)"}
          </button>
        : null}
        {stripeCancelable && !confirmingCancel ?
          <button
            type="button"
            onClick={() => { setMessage(null); setConfirmingCancel(true); }}
            className="rounded-xl border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-red-800 hover:bg-red-950/30 hover:text-red-200"
          >
            Cancel subscription
          </button>
        : null}
        {appStorePro && !confirmingCancel && iosShell ?
          <IosAppStoreManageSubscription />
        : null}
        {appStorePro && !confirmingCancel && !iosShell ?
          <a
            href="https://apps.apple.com/account/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            Cancel or manage subscription
          </a>
        : null}
      </div>
    </section>
  );
}
