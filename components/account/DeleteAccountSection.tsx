"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userEmail: string;
};

export function DeleteAccountSection({ userEmail }: Props) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const deleteAccount = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setMessage(data.error ?? "Could not delete account.");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  }, [confirmEmail, router]);

  return (
    <section className="mt-10 rounded-xl border border-red-900/40 bg-red-950/10 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400/90">
        Delete account
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        This permanently deletes your LineRoom account and associated data,
        subject to your privacy policy. This cannot be undone.
      </p>
      {message ?
        <p className="mt-3 text-sm text-amber-200/90">{message}</p>
      : null}
      <label className="mt-4 block text-xs font-medium text-zinc-500">
        Type your email to confirm
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 focus:border-red-700"
          placeholder={userEmail}
        />
      </label>
      <button
        type="button"
        className="mt-4 rounded-lg bg-red-800/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        disabled={
          busy ||
          confirmEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()
        }
        onClick={() => void deleteAccount()}
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </section>
  );
}
