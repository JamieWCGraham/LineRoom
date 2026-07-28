"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminSongCountBucket,
  AdminStatsResponse,
} from "@/app/api/admin/stats/route";

type SortKey = "songCount" | "email" | "createdAt";
type SortDir = "asc" | "desc";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {detail ?
        <p className="mt-1 text-xs text-zinc-500">{detail}</p>
      : null}
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-left font-medium transition hover:text-zinc-200 ${
        active ? "text-zinc-100" : "text-zinc-500"
      }`}
    >
      {label}
      {active ?
        <span className="text-zinc-400">{dir === "asc" ? "↑" : "↓"}</span>
      : null}
    </button>
  );
}

export function AdminStatsPanel() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideGuests, setHideGuests] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("songCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      const data = (await res.json()) as AdminStatsResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load stats.");
        setStats(null);
        return;
      }
      setStats(data);
    } catch {
      setError("Network error while loading stats.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(key);
      setSortDir(key === "email" ? "asc" : "desc");
    },
    [sortKey],
  );

  const visibleUsers = useMemo(() => {
    if (!stats) return [];
    const filtered =
      hideGuests ? stats.users.filter((u) => !u.isGuest) : stats.users;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "songCount") cmp = a.songCount - b.songCount;
      else if (sortKey === "email") cmp = a.email.localeCompare(b.email);
      else cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [hideGuests, sortDir, sortKey, stats]);

  const maxBucketCount = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...stats.songCountBuckets.map((b) => b.userCount), 1);
  }, [stats]);

  return (
    <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Dashboard</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            User and song metrics across the platform.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadStats()}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ?
        <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      : null}

      {stats ?
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard
              label="Registered users"
              value={stats.registeredUsers}
              detail={`${stats.guestUsers} guest`}
            />
            <StatCard
              label="Pro users"
              value={stats.proUsers}
              detail={
                [
                  stats.paidProUsers > 0 ? `${stats.paidProUsers} paid` : null,
                  stats.bypassProUsers > 0 ?
                    `${stats.bypassProUsers} bypass`
                  : null,
                  stats.registeredUsers > 0 ?
                    `${Math.round((stats.proUsers / stats.registeredUsers) * 100)}% of registered`
                  : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
            <StatCard label="Total songs" value={stats.totalSongs} />
            <StatCard
              label="Published songs"
              value={stats.publishedSongs}
              detail={`${stats.usersWithSongs} users with songs`}
            />
            <StatCard
              label="Avg songs / registered user"
              value={stats.avgSongsPerRegisteredUser}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-200">
              Registered users by song count
            </h3>
            <ul className="mt-3 space-y-2">
              {stats.songCountBuckets.map((bucket: AdminSongCountBucket) => (
                <li key={bucket.label} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-zinc-400">{bucket.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full bg-amber-700/80"
                      style={{
                        width: `${(bucket.userCount / maxBucketCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-zinc-300">
                    {bucket.userCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-200">Users</h3>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={hideGuests}
                onChange={(e) => setHideGuests(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-950 text-amber-600 focus:ring-amber-700"
              />
              Hide guest accounts
            </label>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800/80">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-800/80 bg-zinc-950/60 text-left">
                <tr>
                  <th className="px-3 py-2.5">
                    <SortButton
                      label="Email"
                      active={sortKey === "email"}
                      dir={sortDir}
                      onClick={() => toggleSort("email")}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-zinc-500">Display name</th>
                  <th className="px-3 py-2.5">
                    <SortButton
                      label="Songs"
                      active={sortKey === "songCount"}
                      dir={sortDir}
                      onClick={() => toggleSort("songCount")}
                    />
                  </th>
                  <th className="px-3 py-2.5">
                    <SortButton
                      label="Joined"
                      active={sortKey === "createdAt"}
                      dir={sortDir}
                      onClick={() => toggleSort("createdAt")}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-zinc-500">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {visibleUsers.length === 0 ?
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                      No users to show.
                    </td>
                  </tr>
                : visibleUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-950/40">
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-zinc-200">
                        {user.email}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-zinc-400">
                        {user.displayName ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-200">
                        {user.songCount}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        {user.isGuest ?
                          <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-400">
                            Guest
                          </span>
                        : user.isPro ?
                          <span className="rounded-md bg-amber-950/60 px-2 py-0.5 text-xs text-amber-200">
                            Pro
                          </span>
                        : user.isBillingBypass ?
                          <span className="rounded-md bg-sky-950/60 px-2 py-0.5 text-xs text-sky-200">
                            Bypass
                          </span>
                        : <span className="rounded-md bg-emerald-950/50 px-2 py-0.5 text-xs text-emerald-300">
                            Free
                          </span>
                        }
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Showing {visibleUsers.length} of {stats.totalUsers} users
            {hideGuests ? " (guests hidden)" : ""}.
          </p>
        </>
      : loading ?
        <p className="mt-5 text-sm text-zinc-500">Loading dashboard…</p>
      : null}
    </div>
  );
}
