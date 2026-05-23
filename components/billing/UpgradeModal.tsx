"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IosProSubscription } from "@/components/billing/IosProSubscription";
import {
  billingClientPlatformHeaders,
  isIosCapacitorApp,
  useIosCapacitorAppLayout,
} from "@/lib/platform/capacitor-client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UpgradeModal({ open, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iosShell = useIosCapacitorAppLayout();

  if (!open) return null;

  async function startCheckout() {
    if (isIosCapacitorApp()) {
      setError(
        "Use “Subscribe with App Store” in this app. Stripe checkout is not available on iOS.",
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { ...billingClientPlatformHeaders() },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Checkout failed.");
        return;
      }
      if (data.url) {
        if (isIosCapacitorApp()) {
          setError(
            "Use “Subscribe with App Store” in this app. Stripe checkout is not available on iOS.",
          );
          return;
        }
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold text-zinc-100"
        >
          Upgrade to LineRoom Pro
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          You&apos;ve used your free critiques. Upgrade to LineRoom Pro for
          unlimited critique generation.
        </p>
        {error ?
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        : null}

        {iosShell ?
          <div className="mt-4">
            <IosProSubscription
              hasActiveSubscription={false}
              isBypassed={false}
              subscribeCtaLabel="Upgrade to Pro"
              showRequiredLabels
              onEntitlementUpdated={() => {
                void (async () => {
                  try {
                    await fetch("/api/billing/access");
                  } catch {
                    /* ignore */
                  }
                  router.refresh();
                  onClose();
                })();
              }}
            />
          </div>
        : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {!iosShell ?
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={busy}
              className="rounded-lg bg-blue-700/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? "Opening checkout…" : "Upgrade"}
            </button>
          : null}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
