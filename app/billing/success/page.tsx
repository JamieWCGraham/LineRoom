"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BillingSuccessPage() {
  const router = useRouter();
  const [note, setNote] = useState("Activating subscription…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (let i = 0; i < 45; i++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/billing/access");
          const data = (await res.json()) as {
            access?: { hasActiveSubscription?: boolean };
          };
          if (data.access?.hasActiveSubscription) {
            if (!cancelled) {
              setNote("Subscription active. Redirecting…");
              router.replace("/account");
            }
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) {
        setNote(
          "Still processing. If you completed checkout, open Account and tap Refresh status.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Thanks!</h1>
      <p className="mt-3 text-sm text-zinc-400">{note}</p>
      <p className="mt-8 text-sm">
        <Link href="/account" className="text-amber-500/90 underline">
          Account
        </Link>
        {" · "}
        <Link href="/lineroom" className="text-amber-500/90 underline">
          LineRoom
        </Link>
      </p>
    </div>
  );
}
