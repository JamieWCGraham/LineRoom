import type { SupabaseClient, User } from "@supabase/supabase-js";
import { collectDraftRecordingPathsFromUserSongs } from "@/lib/account/collectDraftRecordingPaths";
import { billingLog } from "@/lib/billing/logger";
import {
  fetchSubscriptionForUser,
  subscriptionIsPaid,
} from "@/lib/billing/subscription-row";
import { upsertSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import {
  removeAllDraftRecordingsForUser,
  removeExplicitRecordingPaths,
} from "@/lib/draft-recordings/removeSongRecordings";
import { getStripe } from "@/lib/stripe";

export type DeleteUserDataInput = {
  userId: string;
  userEmail: string | null;
  acknowledgeAppStoreSub?: boolean;
};

export type DeleteUserDataResult =
  | { ok: true }
  | { ok: false; status: number; code?: string; error: string; message?: string };

export type ResolvedUser = {
  id: string;
  email: string | null;
};

/**
 * Resolves a Supabase auth user by email or user id (service role).
 */
export async function resolveUserByEmailOrId(
  admin: SupabaseClient,
  opts: { email?: string; userId?: string },
): Promise<ResolvedUser | null> {
  const userId = opts.userId?.trim();
  if (userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  const email = opts.email?.trim().toLowerCase();
  if (!email) return null;

  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) return null;

    const match = data.users.find(
      (u) => u.email?.trim().toLowerCase() === email,
    );
    if (match) {
      return { id: match.id, email: match.email ?? null };
    }

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

/**
 * Deletes billing artifacts, storage, and the auth user for a LineRoom account.
 */
export async function deleteUserAndData(
  admin: SupabaseClient,
  input: DeleteUserDataInput,
): Promise<DeleteUserDataResult> {
  const userId = input.userId.trim();
  if (!userId) {
    return { ok: false, status: 400, error: "Missing user id." };
  }

  const sub = await fetchSubscriptionForUser(admin, userId);

  if (sub?.billing_provider === "app_store" && subscriptionIsPaid(sub)) {
    if (!input.acknowledgeAppStoreSub) {
      return {
        ok: false,
        status: 409,
        code: "active_app_store_subscription",
        error: "active_app_store_subscription",
        message:
          "You have an active App Store subscription. " +
          "Deleting your account will not cancel it — you must cancel " +
          "in Settings > Subscriptions on your iPhone. " +
          "Confirm you understand to proceed.",
      };
    }
    billingLog.info("Account delete proceeding with active App Store sub", {
      userId,
      originalTxId: sub.app_store_original_transaction_id,
    });
    await admin
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId);
  }

  const stripeCustomerId = sub?.stripe_customer_id?.trim() || null;

  if (sub?.stripe_subscription_id && sub.billing_provider !== "app_store") {
    try {
      const canceled = await getStripe().subscriptions.cancel(
        sub.stripe_subscription_id,
      );
      await upsertSubscriptionFromStripe(admin, canceled, {
        explicitUserId: userId,
        statusOverride: "canceled",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      billingLog.error("Stripe cancel before account delete failed", {
        userId,
        error: msg,
      });
    }
  }

  if (stripeCustomerId && sub?.billing_provider !== "app_store") {
    try {
      await getStripe().customers.del(stripeCustomerId);
      billingLog.info("Deleted Stripe customer", {
        userId,
        stripeCustomerId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      billingLog.error("Stripe customer delete before account delete failed", {
        userId,
        stripeCustomerId,
        error: msg,
      });
    }
  }

  try {
    const pathsFromMeta = await collectDraftRecordingPathsFromUserSongs(
      admin,
      userId,
    );
    await removeExplicitRecordingPaths(pathsFromMeta);
    await removeAllDraftRecordingsForUser(userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    billingLog.error("Draft recordings cleanup before account delete failed", {
      userId,
      error: msg,
    });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    billingLog.error("Account delete failed", {
      userId,
      error: error.message,
    });
    return { ok: false, status: 500, error: error.message };
  }

  billingLog.info("Account deleted", { userId, email: input.userEmail });
  return { ok: true };
}

export type UserDeletionPreview = {
  userId: string;
  email: string | null;
  songCount: number;
  billingProvider: string | null;
  subscriptionStatus: string | null;
  storagePrefix: string;
};

/** Summarizes what would be deleted (for operator dry-run). */
export async function previewUserDeletion(
  admin: SupabaseClient,
  user: Pick<User, "id" | "email"> | ResolvedUser,
): Promise<UserDeletionPreview> {
  const userId = user.id;
  const [sub, songs] = await Promise.all([
    fetchSubscriptionForUser(admin, userId),
    admin.from("songs").select("id", { count: "exact", head: true }).eq(
      "user_id",
      userId,
    ),
  ]);

  return {
    userId,
    email: user.email ?? null,
    songCount: songs.count ?? 0,
    billingProvider: sub?.billing_provider ?? null,
    subscriptionStatus: sub?.status ?? null,
    storagePrefix: `${userId}/`,
  };
}
