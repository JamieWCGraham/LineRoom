"use client";

import { useState } from "react";
import { configureIosPurchasePluginValidator } from "@/lib/billing/configure-ios-purchase-validator";
import { createClient } from "@/lib/supabase/client";
import { useIosCapacitorAppLayout } from "@/lib/platform/capacitor-client";

const productId = process.env.NEXT_PUBLIC_IOS_IAP_PRODUCT_ID?.trim();

/**
 * Opens Apple’s system subscription UI (cancel, change plan, etc.) for
 * StoreKit / App Store–billed Pro. Requires the purchase plugin to be
 * initialized like a normal IAP flow.
 */
export function IosAppStoreManageSubscription() {
  const nativeIos = useIosCapacitorAppLayout();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!nativeIos) return null;

  async function openManage() {
    setMsg(null);
    if (!productId) {
      setMsg("Subscription product id is not configured.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMsg("Sign in to manage your subscription.");
        return;
      }

      const mod = await import("capacitor-plugin-cdv-purchase");
      const { store, ProductType, Platform } = mod;

      configureIosPurchasePluginValidator(store);
      store.applicationUsername = user.id;

      store.error((err) => {
        setMsg(err.message ?? "Store error");
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
        const text = errs.map((e) => e.message).join(" ") || "Store init failed";
        setMsg(text);
        return;
      }

      const err = await store.manageSubscriptions(Platform.APPLE_APPSTORE);
      if (err) setMsg(err.message ?? "Could not open subscription settings.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void openManage()}
        disabled={busy}
        className="rounded-xl border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Cancel or manage in App Store"}
      </button>
      {msg ?
        <p className="text-sm text-rose-300" role="alert">
          {msg}
        </p>
      : null}
    </div>
  );
}
