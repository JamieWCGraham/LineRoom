"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { configureIosPurchasePluginValidator } from "@/lib/billing/configure-ios-purchase-validator";
import { createClient } from "@/lib/supabase/client";
import { useIosCapacitorAppLayout } from "@/lib/platform/capacitor-client";

const productId = process.env.NEXT_PUBLIC_IOS_IAP_PRODUCT_ID?.trim();

type CdvPurchaseModule = typeof import("capacitor-plugin-cdv-purchase");

/** `store.when()` must only be registered once per JS context (remount-safe). */
let cdvPurchaseWhenHandlersAttached = false;

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
  const [iapOfferReady, setIapOfferReady] = useState(false);
  const nativeIos = useIosCapacitorAppLayout();
  const initPromise = useRef<Promise<boolean> | null>(null);
  const initErrorRef = useRef<string | null>(null);
  const storeModuleRef = useRef<CdvPurchaseModule | null>(null);
  const onUpdatedRef = useRef(onEntitlementUpdated);
  onUpdatedRef.current = onEntitlementUpdated;

  const rememberInitError = useCallback((text: string | null) => {
    initErrorRef.current = text;
  }, []);

  const refreshOfferIfNeeded = useCallback(
    async (store: CdvPurchaseModule["store"]) => {
      const { Platform } = storeModuleRef.current!;
      let prod = store.get(productId!, Platform.APPLE_APPSTORE);
      let loaded = Boolean(prod?.getOffer());
      if (loaded || !store.isReady) return true;

      const prevMin = store.minTimeBetweenUpdates;
      store.minTimeBetweenUpdates = 0;
      try {
        await store.update();
      } catch {
        /* ignore */
      } finally {
        store.minTimeBetweenUpdates = prevMin;
      }
      prod = store.get(productId!, Platform.APPLE_APPSTORE);
      loaded = Boolean(prod?.getOffer());
      return loaded;
    },
    [],
  );

  const ensureStoreReady = useCallback(async () => {
    if (!nativeIos || !productId || isBypassed || hasActiveSubscription) {
      setIapOfferReady(false);
      return false;
    }
    if (initPromise.current) return initPromise.current;

    const run = async (): Promise<boolean> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        rememberInitError("Sign in before subscribing with the App Store.");
        setIapOfferReady(false);
        return false;
      }

      const mod = await import("capacitor-plugin-cdv-purchase");
      storeModuleRef.current = mod;
      const { store, ProductType, Platform } = mod;

      configureIosPurchasePluginValidator(store);
      store.applicationUsername = user.id;

      store.error((err) => {
        const text = err.message ?? "Store error";
        rememberInitError(text);
        setMsg(text);
      });

      if (!cdvPurchaseWhenHandlersAttached) {
        cdvPurchaseWhenHandlersAttached = true;
        store
          .when()
          .productUpdated((p) => {
            if (p.id !== productId) return;
            const loaded = Boolean(p.getOffer());
            if (loaded) rememberInitError(null);
            if (loaded) setIapOfferReady(true);
          })
          .approved((t) => {
            void t.verify();
          })
          .verified((r) => {
            setMsg("Subscription active.");
            onUpdatedRef.current?.();
            void r.finish();
          });
      }

      store.register([
        {
          id: productId,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        },
      ]);

      const errs = await store.initialize([Platform.APPLE_APPSTORE]);
      const prod = store.get(productId, Platform.APPLE_APPSTORE);
      let loaded = Boolean(prod?.getOffer());

      if (errs?.length) {
        const text = errs.map((e) => e.message).join(" ") || "Store init failed";
        rememberInitError(text);
        setMsg(text);
        if (!loaded) {
          loaded = await refreshOfferIfNeeded(store);
        }
        if (!loaded) {
          setIapOfferReady(false);
          return false;
        }
        setIapOfferReady(true);
        return true;
      }

      if (!loaded) {
        loaded = await refreshOfferIfNeeded(store);
      }

      if (!loaded) {
        rememberInitError(
          "The App Store did not return this subscription product. Confirm the product id, bundle id, IAP status, and TestFlight/sandbox setup.",
        );
        setIapOfferReady(false);
        return false;
      }

      setIapOfferReady(true);
      return true;
    };

    const p = run();
    initPromise.current = p;
    try {
      const ok = await p;
      if (!ok) initPromise.current = null;
      return ok;
    } catch {
      initPromise.current = null;
      setIapOfferReady(false);
      return false;
    }
  }, [
    nativeIos,
    hasActiveSubscription,
    isBypassed,
    rememberInitError,
    refreshOfferIfNeeded,
  ]);

  useEffect(() => {
    if (!nativeIos || !productId || isBypassed || hasActiveSubscription) {
      setIapOfferReady(false);
      return;
    }
    void ensureStoreReady();
  }, [nativeIos, hasActiveSubscription, isBypassed, ensureStoreReady]);

  function purchase() {
    if (!productId) return;
    const mod = storeModuleRef.current;
    if (!iapOfferReady || !mod) {
      setMsg("Still preparing the App Store. Wait a moment and try again.");
      void ensureStoreReady();
      return;
    }

    setBusy(true);
    setMsg(null);

    const { store, Platform } = mod;
    const offer = store.get(productId, Platform.APPLE_APPSTORE)?.getOffer();
    if (!offer) {
      setMsg(
        initErrorRef.current ??
          "Product not available. Pull to refresh or open the account page again.",
      );
      setBusy(false);
      setIapOfferReady(false);
      initPromise.current = null;
      return;
    }

    void offer
      .order()
      .then((err) => {
        if (err && typeof err === "object" && "message" in err) {
          setMsg(String((err as { message?: string }).message ?? "Purchase failed"));
        }
      })
      .catch((e) => {
        setMsg(e instanceof Error ? e.message : "Purchase failed");
      })
      .finally(() => {
        setBusy(false);
      });
  }

  async function restore() {
    setBusy(true);
    setMsg(null);
    try {
      const ready = await ensureStoreReady();
      if (!ready) {
        setMsg(initErrorRef.current ?? "Product not loaded yet. Try again in a moment.");
        return;
      }
      const mod = storeModuleRef.current ?? (await import("capacitor-plugin-cdv-purchase"));
      storeModuleRef.current = mod;
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
      <p className="mt-3 text-sm text-emerald-200/90">
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
      {msg ?
        <p
          className={`text-sm ${msg.includes("active") ? "text-emerald-200/90" : "text-rose-200/90"}`}
          role="status"
        >
          {msg}
        </p>
      : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={purchase}
          disabled={busy || !iapOfferReady}
          style={{ touchAction: "manipulation" }}
          className="rounded-lg bg-emerald-700/90 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "Working…"
          : !iapOfferReady ? "Preparing App Store…"
          : "Subscribe with App Store"}
        </button>
        <button
          type="button"
          onClick={() => void restore()}
          disabled={busy}
          style={{ touchAction: "manipulation" }}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
        >
          Restore purchases
        </button>
      </div>
    </div>
  );
}
