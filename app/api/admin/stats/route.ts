import { NextResponse } from "next/server";
import { isGuestProfileEmail } from "@/lib/auth/guest";
import { isBillingBypassed } from "@/lib/billing/config";
import { subscriptionIsPaid } from "@/lib/billing/subscription-row";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SubscriptionRow } from "@/types/database";

export type AdminUserStatsItem = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  isGuest: boolean;
  /** Paid subscription (Stripe / App Store). */
  isPro: boolean;
  /** Env billing bypass — Pro access without a subscription row. */
  isBillingBypass: boolean;
  songCount: number;
};

export type AdminSongCountBucket = {
  label: string;
  min: number;
  max: number | null;
  userCount: number;
};

export type AdminStatsResponse = {
  totalUsers: number;
  registeredUsers: number;
  guestUsers: number;
  /** Paid subscribers + billing-bypass emails (effective Pro access). */
  proUsers: number;
  paidProUsers: number;
  bypassProUsers: number;
  totalSongs: number;
  publishedSongs: number;
  usersWithSongs: number;
  avgSongsPerRegisteredUser: number;
  songCountBuckets: AdminSongCountBucket[];
  users: AdminUserStatsItem[];
};

const SONG_COUNT_BUCKETS: Array<{ label: string; min: number; max: number | null }> =
  [
    { label: "0 songs", min: 0, max: 0 },
    { label: "1 song", min: 1, max: 1 },
    { label: "2–5 songs", min: 2, max: 5 },
    { label: "6–10 songs", min: 6, max: 10 },
    { label: "11+ songs", min: 11, max: null },
  ];

function bucketSongCount(count: number): AdminSongCountBucket["label"] {
  for (const bucket of SONG_COUNT_BUCKETS) {
    if (bucket.max === null && count >= bucket.min) return bucket.label;
    if (count >= bucket.min && count <= bucket.max!) return bucket.label;
  }
  return SONG_COUNT_BUCKETS[0]!.label;
}

/**
 * `GET /api/admin/stats`
 *
 * Aggregate user and song metrics for the admin dashboard. Requires evals access.
 */
export async function GET() {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 500 },
    );
  }

  const [
    profilesResult,
    songsResult,
    totalSongsResult,
    publishedSongsResult,
    subscriptionsResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, display_name, created_at")
      .order("created_at", { ascending: false }),
    admin.from("songs").select("user_id"),
    admin.from("songs").select("id", { count: "exact", head: true }),
    admin
      .from("songs")
      .select("id", { count: "exact", head: true })
      .not("published_at", "is", null),
    admin
      .from("subscriptions")
      .select(
        "user_id, status, billing_provider, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, stripe_price_id, app_store_original_transaction_id, app_store_product_id, email, created_at, updated_at",
      ),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }
  if (songsResult.error) {
    return NextResponse.json({ error: songsResult.error.message }, { status: 500 });
  }
  if (totalSongsResult.error) {
    return NextResponse.json({ error: totalSongsResult.error.message }, { status: 500 });
  }
  if (publishedSongsResult.error) {
    return NextResponse.json(
      { error: publishedSongsResult.error.message },
      { status: 500 },
    );
  }
  if (subscriptionsResult.error) {
    return NextResponse.json(
      { error: subscriptionsResult.error.message },
      { status: 500 },
    );
  }

  const songCountByUser = new Map<string, number>();
  for (const row of songsResult.data ?? []) {
    const userId = row.user_id as string;
    songCountByUser.set(userId, (songCountByUser.get(userId) ?? 0) + 1);
  }

  const proUserIds = new Set<string>();
  for (const row of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
    if (subscriptionIsPaid(row)) {
      proUserIds.add(row.user_id);
    }
  }

  const profiles = profilesResult.data ?? [];
  const users: AdminUserStatsItem[] = profiles.map((row) => {
    const email = row.email as string;
    const id = row.id as string;
    const isPro = proUserIds.has(id);
    const isBypass = isBillingBypassed(email);
    return {
      id,
      email,
      displayName: (row.display_name as string | null) ?? null,
      createdAt: row.created_at as string,
      isGuest: isGuestProfileEmail(email),
      isPro,
      isBillingBypass: isBypass,
      songCount: songCountByUser.get(id) ?? 0,
    };
  });

  const guestUsers = users.filter((u) => u.isGuest).length;
  const registeredUsers = users.length - guestUsers;
  const paidProUsers = users.filter((u) => u.isPro).length;
  const bypassProUsers = users.filter(
    (u) => u.isBillingBypass && !u.isPro && !u.isGuest,
  ).length;
  const proUsers = users.filter(
    (u) => !u.isGuest && (u.isPro || u.isBillingBypass),
  ).length;
  const usersWithSongs = users.filter((u) => u.songCount > 0).length;
  const registeredSongTotal = users
    .filter((u) => !u.isGuest)
    .reduce((sum, u) => sum + u.songCount, 0);
  const avgSongsPerRegisteredUser =
    registeredUsers > 0 ?
      Math.round((registeredSongTotal / registeredUsers) * 10) / 10
    : 0;

  const bucketCounts = new Map<string, number>(
    SONG_COUNT_BUCKETS.map((b) => [b.label, 0]),
  );
  for (const user of users.filter((u) => !u.isGuest)) {
    const label = bucketSongCount(user.songCount);
    bucketCounts.set(label, (bucketCounts.get(label) ?? 0) + 1);
  }

  const songCountBuckets: AdminSongCountBucket[] = SONG_COUNT_BUCKETS.map(
    (bucket) => ({
      ...bucket,
      userCount: bucketCounts.get(bucket.label) ?? 0,
    }),
  );

  users.sort((a, b) => b.songCount - a.songCount || b.createdAt.localeCompare(a.createdAt));

  const stats: AdminStatsResponse = {
    totalUsers: users.length,
    registeredUsers,
    guestUsers,
    proUsers,
    paidProUsers,
    bypassProUsers,
    totalSongs: totalSongsResult.count ?? 0,
    publishedSongs: publishedSongsResult.count ?? 0,
    usersWithSongs,
    avgSongsPerRegisteredUser,
    songCountBuckets,
    users,
  };

  return NextResponse.json(stats);
}
