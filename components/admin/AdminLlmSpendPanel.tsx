"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminLlmSpendResponse } from "@/app/api/admin/llm-spend/route";
import type { LangfuseSpendSlice } from "@/lib/langfuse/metrics";

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

type UsersResponse = {
  users?: AdminUser[];
  error?: string;
};

type DaysPreset = 7 | 30 | 90;

function formatUserLabel(user: AdminUser): string {
  const name = user.displayName?.trim();
  return name ? `${user.email} — ${name}` : user.email;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function SpendCard({
  label,
  slice,
}: {
  label: string;
  slice: LangfuseSpendSlice;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">
        {formatUsd(slice.totalCost)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {formatTokens(slice.totalTokens)} tokens · {slice.observationCount}{" "}
        observations
      </p>
    </div>
  );
}

export function AdminLlmSpendPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [days, setDays] = useState<DaysPreset>(30);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spend, setSpend] = useState<AdminLlmSpendResponse | null>(null);

  const loadUsers = useCallback(async (q: string) => {
    setLoadingUsers(true);
    setError(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/admin/users${qs}`);
      const data = (await res.json()) as UsersResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not load users.");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Network error while loading users.");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers("");
  }, [loadUsers]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  const loadSpend = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setSpend(null);
    try {
      const qs = new URLSearchParams({
        userId: selectedId,
        days: String(days),
      });
      const res = await fetch(`/api/admin/llm-spend?${qs.toString()}`);
      const data = (await res.json()) as AdminLlmSpendResponse & {
        error?: string;
        configured?: boolean;
      };
      if (!res.ok) {
        setError(
          data.error ??
            (data.configured === false ?
              "Langfuse is not configured on this environment."
            : "Could not load LLM spend."),
        );
        return;
      }
      setSpend(data);
    } catch {
      setError("Network error while loading LLM spend.");
    } finally {
      setBusy(false);
    }
  }, [days, selectedId]);

  return (
    <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">LLM spend</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        On-demand chat + critique cost from Langfuse for a single user. Chat
        attribution applies to traffic after userId wiring was deployed.
      </p>

      {error ?
        <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      : null}

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-zinc-400">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadUsers(search);
            }}
            placeholder="Email or display name"
            className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 transition focus:border-amber-700 focus:ring-2"
          />
        </label>
        <button
          type="button"
          className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
          disabled={loadingUsers}
          onClick={() => void loadUsers(search)}
        >
          {loadingUsers ? "Loading…" : "Search"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block text-xs font-medium text-zinc-400">
          User
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setSpend(null);
            }}
            disabled={loadingUsers || users.length === 0}
            className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 transition focus:border-amber-700 focus:ring-2"
          >
            <option value="">
              {loadingUsers ?
                "Loading users…"
              : users.length === 0 ?
                "No users found"
              : "Select a user"}
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {formatUserLabel(user)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="text-xs font-medium text-zinc-400">
          <legend className="mb-1.5">Range</legend>
          <div className="flex gap-2">
            {([7, 30, 90] as DaysPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDays(preset);
                  setSpend(null);
                }}
                className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                  days === preset ?
                    "border-amber-700/70 bg-amber-950/40 text-amber-100"
                  : "border-zinc-600 text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {preset}d
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50 sm:w-auto"
        disabled={busy || !selectedId}
        onClick={() => void loadSpend()}
      >
        {busy ? "Loading spend…" : "Load spend"}
      </button>

      {selectedUser ?
        <p className="mt-3 text-xs text-zinc-500">
          Looking up {selectedUser.email} ({selectedUser.id}) · last {days} days
        </p>
      : null}

      {spend ?
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SpendCard label="Total" slice={spend.total} />
          <SpendCard label="Chat" slice={spend.chat} />
          <SpendCard label="Critique" slice={spend.critique} />
        </div>
      : null}
    </div>
  );
}
