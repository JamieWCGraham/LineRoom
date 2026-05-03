"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIosCapacitorAppLayout } from "@/lib/platform/capacitor-client";

const productId = process.env.NEXT_PUBLIC_IOS_IAP_PRODUCT_ID?.trim();

type Props = {
  hasActiveSubscription: boolean;
  isBypassed: boolean;
  onEntitlementUpdated?: () => void;
};

export function IosProSubscription({
  hasActiveSubscription,
  isBypassed,
  onEntitlementUpdated,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nativeIos = useIosCapacitorAppLayout();
  const initDone = useRef(false);
  const onUpdatedRef = useRef(onEntitlementUpdated);
  onUpdatedRef.current = onEntitlementUpdated;

  useEffect(() => {
    if (!nativeIos || !productId || isBypassed || hasActiveSubscription) return;
    if (initDone.current) return;
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const mod = await import("capacitor-plugin-cdv-purchase");
      if (cancelled) return;

      const { store, ProductType, Platform } = mod;

      store.validator = `${window.location.origin}/api/billing/ios/plugin-validator`;
      store.applicationUsername = user.id;

      store.error((err) => {
        setMsg(err.message ?? "Store error");
      });

      store
        .when()
        .approved((t) => {
          void t.verify();
        })
        .verified((r) => {
          setMsg("Subscription active.");
          onUpdatedRef.current?.();
          void r.finish();
        });

      store.register([
        {
          id: productId,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        },
      ]);

      const errs = await store.initialize([Platform.APPLE_APPSTORE]);
      if (errs?.length) {
        setMsg(errs.map((e) => e.message).join(" ") || "Store init failed");
      }
      initDone.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [nativeIos, hasActiveSubscription, isBypassed]);

  async function purchase() {
    if (!productId) return;
    setBusy(true);
    setMsg(null);
    try {
      const mod = await import("capacitor-plugin-cdv-purchase");
      const { store, Platform } = mod;
      const prod = store.get(productId, Platform.APPLE_APPSTORE);
      const offer = prod?.getOffer();
      if (!offer) {
        setMsg("Product not loaded yet. Try again in a moment.");
        return;
      }
      const err = await offer.order();
      if (err) setMsg(err.message ?? "Purchase failed");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setMsg(null);
    try {
      const mod = await import("capacitor-plugin-cdv-purchase");
      const { store } = mod;
      const err = await store.restorePurchases();
      if (err) setMsg(err.message ?? "Restore failed");
      else {
        setMsg("Restored purchases.");
        onUpdatedRef.current?.();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  if (!nativeIos) return null;
  if (isBypassed || hasActiveSubscription) return null;

  if (!productId) {
    return (
      <p className="mt-3 text-sm text-amber-200/90">
        iOS subscriptions are not configured. Set{" "}
        <code className="text-zinc-300">NEXT_PUBLIC_IOS_IAP_PRODUCT_ID</code> to
        your auto-renewable product id from App Store Connect, then rebuild the
        web app and run{" "}
        <code className="text-zinc-300">npm run cap:sync:ios:production</code>.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <p className="text-sm leading-relaxed text-zinc-400">
        LineRoom Pro on iOS is purchased through the App Store. If you already
        subscribe on the web (Stripe), manage that plan in a desktop browser;
        Apple does not allow the same upgrade to be sold with Stripe inside this
        app.
      </p>
      {msg ?
        <p className="text-sm text-amber-200/90">{msg}</p>
      : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void purchase()}
          disabled={busy}
          className="rounded-lg bg-amber-700/90 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Working…" : "Subscribe with App Store"}
        </button>
        <button
          type="button"
          onClick={() => void restore()}
          disabled={busy}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
        >
          Restore purchases
        </button>
      </div>
    </div>
  );
}
