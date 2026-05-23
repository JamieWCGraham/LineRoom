"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IosSubscriptionDisclosure } from "@/components/billing/IosSubscriptionDisclosure";
import { configureIosPurchasePluginValidator } from "@/lib/billing/configure-ios-purchase-validator";
import {
  buildIosSubscriptionDisplay,
  type IosSubscriptionDisplay,
} from "@/lib/billing/ios-subscription-disclosure";
import { createClient } from "@/lib/supabase/client";
import { useIosCapacitorAppLayout } from "@/lib/platform/capacitor-client";

const productId = process.env.NEXT_PUBLIC_IOS_IAP_PRODUCT_ID?.trim();

type CdvPurchaseModule = typeof import("capacitor-plugin-cdv-purchase");

/* ────────────────────────────────────────────────────────────────────────────
 * Module-scoped singleton.
 *
 * `cdv-purchase`'s `store.register()`, `store.initialize()`, `store.when()`
 * and `store.error()` register internal listeners that MUST only run once per
 * JS context — re-registering on every component remount leaks listeners and
 * leaves stale closures bound to unmounted React state.
 *
 * The previous implementation used a single boolean flag (`...HandlersAttached`)
 * but the `productUpdated` callback captured `setIapOfferReady` from the FIRST
 * mount only. After navigating (e.g. opening the UpgradeModal after the
 * Account page mounted the billing section) the new component instance never
 * received `productUpdated` callbacks, so its button stayed disabled in
 * "Preparing App Store…" forever. When `iapOfferReady` was forced to `true`
 * via the buggy `refreshOfferIfNeeded` (which returned `true` when
 * `!store.isReady`), the button became clickable but `offer.order()` resolved
 * immediately because the offer wasn't actually loaded — producing the
 * "flickers and shows nothing" symptom.
 *
 * Solution: keep live state in module scope and expose a tiny pub/sub so any
 * mounted instance always reads the current state.
 * ────────────────────────────────────────────────────────────────────────── */

type StoreSnapshot = {
  module: CdvPurchaseModule | null;
  offerReady: boolean;
  initError: string | null;
  busyMessage: string | null;
  subscriptionDisplay: IosSubscriptionDisplay | null;
};

let snapshot: StoreSnapshot = {
  module: null,
  offerReady: false,
  initError: null,
  busyMessage: null,
  subscriptionDisplay: null,
};

function refreshSubscriptionDisplay(mod: CdvPurchaseModule): void {
  if (!productId) return;
  const { store, Platform } = mod;
  const product = store.get(productId, Platform.APPLE_APPSTORE);
  const offer = product?.getOffer();
  if (!product || !offer) {
    setSnapshot({ subscriptionDisplay: null });
    return;
  }
  setSnapshot({
    subscriptionDisplay: buildIosSubscriptionDisplay(product, offer),
  });
}

const subscribers = new Set<() => void>();

let storeListenersAttached = false;
let storeInitialized = false;
let initPromise: Promise<boolean> | null = null;
const onVerifiedRef: { current: (() => void) | null } = { current: null };

function emit(): void {
  for (const s of Array.from(subscribers)) s();
}

function setSnapshot(patch: Partial<StoreSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function offerLoaded(mod: CdvPurchaseModule): boolean {
  if (!productId) return false;
  const { store, Platform } = mod;
  return Boolean(store.get(productId, Platform.APPLE_APPSTORE)?.getOffer());
}

/**
 * One-shot store init. Returns true once the offer is loaded, false on any
 * unrecoverable error. Subsequent callers share the same in-flight promise.
 *
 * If a previous attempt failed, calling this again clears the cached promise
 * and retries from scratch.
 */
async function ensureStoreReadySingleton(): Promise<boolean> {
  if (!productId) return false;

  if (snapshot.module && offerLoaded(snapshot.module)) {
    if (!snapshot.offerReady) {
      setSnapshot({ offerReady: true, initError: null });
    }
    return true;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSnapshot({
          initError: "Sign in before subscribing with the App Store.",
          offerReady: false,
        });
        return false;
      }

      const mod =
        snapshot.module ?? (await import("capacitor-plugin-cdv-purchase"));
      if (!snapshot.module) setSnapshot({ module: mod });

      const { store, ProductType, Platform } = mod;

      // Single property assignment — safe to repeat across mounts.
      configureIosPurchasePluginValidator(store);
      store.applicationUsername = user.id;

      // Listener registration: only once per JS context, since cdv-purchase
      // appends to internal lists and never dedupes.
      if (!storeListenersAttached) {
        storeListenersAttached = true;

        store.error((err) => {
          const text = err.message ?? "Store error";
          setSnapshot({ initError: text, busyMessage: text });
        });

        store
          .when()
          .productUpdated((p) => {
            if (p.id !== productId) return;
            const offer = p.getOffer();
            const ready = Boolean(offer);
            if (ready && offer) {
              setSnapshot({
                offerReady: true,
                initError: null,
                subscriptionDisplay: buildIosSubscriptionDisplay(p, offer),
              });
            }
          })
          .approved((t) => {
            void t.verify();
          })
          .verified((r) => {
            setSnapshot({ busyMessage: "Subscription active." });
            onVerifiedRef.current?.();
            void r.finish();
          });

        store.register([
          {
            id: productId,
            type: ProductType.PAID_SUBSCRIPTION,
            platform: Platform.APPLE_APPSTORE,
          },
        ]);
      }

      if (!storeInitialized) {
        storeInitialized = true;
        const errs = await store.initialize([Platform.APPLE_APPSTORE]);
        if (errs?.length) {
          const text = errs.map((e) => e.message).join(" ") || "Store init failed";
          setSnapshot({ initError: text, busyMessage: text });
        }
      }

      // After initialize() returns the storefront fetch can still be in flight.
      // Force one synchronous refresh; the `productUpdated` listener above will
      // flip `offerReady` once Apple delivers the product.
      if (!offerLoaded(mod) && store.isReady) {
        const prevMin = store.minTimeBetweenUpdates;
        store.minTimeBetweenUpdates = 0;
        try {
          await store.update();
        } catch {
          /* productUpdated/error listeners surface real failures */
        } finally {
          store.minTimeBetweenUpdates = prevMin;
        }
      }

      const ready = offerLoaded(mod);
      if (ready) {
        refreshSubscriptionDisplay(mod);
        setSnapshot({ offerReady: true, initError: null });
        return true;
      }

      setSnapshot({ offerReady: false });
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Store setup failed";
      setSnapshot({ initError: msg, busyMessage: msg, offerReady: false });
      return false;
    }
  })();

  try {
    const ok = await initPromise;
    if (!ok) initPromise = null;
    return ok;
  } catch {
    initPromise = null;
    return false;
  }
}

function useStoreSnapshot(): StoreSnapshot {
  const [snap, setSnap] = useState(snapshot);
  useEffect(() => {
    const sub = () => setSnap(snapshot);
    subscribers.add(sub);
    sub();
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  return snap;
}

/* ────────────────────────────────────────────────────────────────────────── */

type Props = {
  hasActiveSubscription: boolean;
  isBypassed: boolean;
  onEntitlementUpdated?: () => void;
  /** Primary purchase button label (Account page uses “Upgrade to Pro”). */
  subscribeCtaLabel?: string;
  /** Show Subscription / Length / Price labels (Account billing). */
  showRequiredLabels?: boolean;
};

export function IosProSubscription({
  hasActiveSubscription,
  isBypassed,
  onEntitlementUpdated,
  subscribeCtaLabel = "Subscribe with App Store",
  showRequiredLabels = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const nativeIos = useIosCapacitorAppLayout();
  const onUpdatedRef = useRef(onEntitlementUpdated);
  onUpdatedRef.current = onEntitlementUpdated;

  // Keep the singleton's `verified` callback wired to the latest mounted
  // instance's onEntitlementUpdated handler.
  useEffect(() => {
    onVerifiedRef.current = () => onUpdatedRef.current?.();
    return () => {
      // Don't clear — another mount may still need the callback. Latest mount
      // overwrites; on unmount we leave the last known-good handler in place.
    };
  }, []);

  const snap = useStoreSnapshot();

  useEffect(() => {
    if (!nativeIos || !productId || isBypassed || hasActiveSubscription) return;
    void ensureStoreReadySingleton();
  }, [nativeIos, hasActiveSubscription, isBypassed]);

  const purchase = useCallback(() => {
    if (!productId) return;
    setLocalMsg(null);

    const mod = snapshot.module;

    // Fast path: store + offer already loaded → fire `order()` from inside
    // the user-gesture stack, which iOS WKWebView requires for App Store
    // sheets to actually surface.
    if (mod && offerLoaded(mod)) {
      const { store, Platform } = mod;
      const offer = store.get(productId, Platform.APPLE_APPSTORE)?.getOffer();
      if (!offer) {
        setLocalMsg(
          snapshot.initError ??
            "Product not available. Pull to refresh or try again.",
        );
        initPromise = null;
        setSnapshot({ offerReady: false });
        return;
      }
      setBusy(true);
      void offer
        .order()
        .then((err) => {
          if (err && typeof err === "object" && "message" in err) {
            const message = (err as { message?: string }).message;
            setLocalMsg(message ?? "Purchase failed");
          }
        })
        .catch((e) => {
          setLocalMsg(e instanceof Error ? e.message : "Purchase failed");
        })
        .finally(() => {
          setBusy(false);
        });
      return;
    }

    // Slow path: not ready yet. Kick off init; the snapshot subscription will
    // re-render as soon as the offer lands so the next tap takes the fast path.
    setLocalMsg(
      snapshot.initError ??
        "Still loading the App Store. Tap subscribe again in a moment.",
    );
    void ensureStoreReadySingleton();
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);
    setLocalMsg(null);
    try {
      const ready = await ensureStoreReadySingleton();
      if (!ready) {
        setLocalMsg(
          snapshot.initError ?? "Product not loaded yet. Try again in a moment.",
        );
        return;
      }
      const mod = snapshot.module;
      if (!mod) {
        setLocalMsg("Could not load the App Store plugin.");
        return;
      }
      const err = await mod.store.restorePurchases();
      if (err) {
        setLocalMsg(err.message ?? "Restore failed");
      } else {
        setLocalMsg("Restored purchases.");
        onUpdatedRef.current?.();
      }
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }, []);

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

  // Local React message takes precedence over the singleton's last message so
  // user-initiated feedback (e.g. cancellation) doesn't get clobbered.
  const displayMessage = localMsg ?? snap.busyMessage;
  const isPositive = Boolean(
    displayMessage &&
      (displayMessage.includes("active") ||
        displayMessage.includes("Restored")),
  );

  return (
    <div
      className={
        showRequiredLabels ?
          "mt-4 space-y-4"
        : "mt-4 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
      }
    >
      <IosSubscriptionDisclosure
        display={snap.subscriptionDisplay}
        loading={!snap.offerReady && !busy}
        showRequiredLabels={showRequiredLabels}
      />
      {displayMessage ?
        <p
          className={`text-sm ${isPositive ? "text-emerald-200/90" : "text-rose-200/90"}`}
          role="status"
        >
          {displayMessage}
        </p>
      : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={purchase}
          disabled={busy || !snap.offerReady}
          style={{ touchAction: "manipulation" }}
          className={
            showRequiredLabels ?
              "w-full rounded-xl bg-emerald-700/90 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600 disabled:opacity-50 sm:w-auto"
            : "rounded-lg bg-emerald-700/90 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-600 disabled:opacity-50"
          }
        >
          {busy ? "Working…" : subscribeCtaLabel}
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
