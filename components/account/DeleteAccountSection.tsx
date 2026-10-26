"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userEmail: string;
};

type DeleteResponse = {
  error?: string;
  message?: string;
  ok?: boolean;
};

export function DeleteAccountSection({ userEmail }: Props) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAppStoreAck, setPendingAppStoreAck] = useState(false);

  const deleteAccount = useCallback(
    async (acknowledgeAppStoreSub = false) => {
      setMessage(null);
      setBusy(true);
      try {
        const res = await fetch("/api/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmEmail: confirmEmail.trim(),
            ...(acknowledgeAppStoreSub ? { acknowledgeAppStoreSub: true } : {}),
          }),
        });
        const data = (await res.json()) as DeleteResponse;

        if (res.status === 409 && data.error === "active_app_store_subscription") {
          setPendingAppStoreAck(true);
          setMessage(
            data.message ??
              "You have an active App Store subscription that must be cancelled in iOS Settings.",
          );
          return;
        }

        if (!res.ok) {
          setMessage(data.error ?? "Could not delete account.");
          return;
        }
        posthog.capture("account_deleted");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/");
        router.refresh();
      } catch {
        setMessage("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [confirmEmail, router],
  );

  const emailMatches =
    confirmEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();

  return (
    <section id="delete-account" className="scroll-mt-6">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Delete account
      </p>
      <div className="mt-2 rounded-2xl border border-red-900/50 bg-red-950/10 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-zinc-500">
          This permanently deletes your LineRoom account and associated data.
          This cannot be undone.
        </p>
        {message ?
          <p className="mt-3 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {message}
          </p>
        : null}
        <label className="mt-4 block text-xs font-medium text-zinc-400">
          Type your email to confirm
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => {
              setConfirmEmail(e.target.value);
              setPendingAppStoreAck(false);
            }}
            autoComplete="off"
            className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 transition focus:border-red-700 focus:ring-2"
            placeholder={userEmail}
          />
        </label>
        {pendingAppStoreAck ?
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-red-800/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            disabled={busy || !emailMatches}
            onClick={() => void deleteAccount(true)}
          >
            {busy ?
              "Deleting…"
            : "I understand — delete my account anyway"}
          </button>
        : <button
            type="button"
            className="mt-4 w-full rounded-xl bg-red-800/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            disabled={busy || !emailMatches}
            onClick={() => void deleteAccount()}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        }
      </div>
    </section>
  );
}
