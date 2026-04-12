"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UpgradeModal({ open, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function startCheckout() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Checkout failed.");
        return;
      }
      if (data.url) {
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
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={busy}
            className="rounded-lg bg-blue-700/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? "Opening checkout…" : "Upgrade"}
          </button>
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
