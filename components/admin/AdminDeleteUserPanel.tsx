"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

type DeleteResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function formatUserLabel(user: AdminUser): string {
  const name = user.displayName?.trim();
  return name ? `${user.email} — ${name}` : user.email;
}

export function AdminDeleteUserPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadUsers = useCallback(async (q: string) => {
    setLoadingUsers(true);
    setMessage(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/admin/users${qs}`);
      const data = (await res.json()) as UsersResponse;
      if (!res.ok) {
        setMessage(data.error ?? "Could not load users.");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setMessage("Network error while loading users.");
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

  const emailMatches =
    selectedUser &&
    confirmEmail.trim().toLowerCase() === selectedUser.email.trim().toLowerCase();

  const deleteUser = useCallback(async () => {
    if (!selectedUser) return;
    setMessage(null);
    setSuccess(false);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          confirmEmail: confirmEmail.trim(),
        }),
      });
      const data = (await res.json()) as DeleteResponse;
      if (!res.ok) {
        setMessage(data.message ?? data.error ?? "Could not delete user.");
        return;
      }
      setSuccess(true);
      setSelectedId("");
      setConfirmEmail("");
      await loadUsers(search);
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  }, [confirmEmail, loadUsers, search, selectedUser]);

  return (
    <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Delete user</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Permanently removes a user&apos;s account, profile, songs, recordings, and
        billing data. This cannot be undone. Active App Store subscriptions are
        not cancelled automatically.
      </p>

      {message ?
        <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {message}
        </p>
      : null}
      {success ?
        <p className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          User deleted successfully.
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

      <label className="mt-4 block text-xs font-medium text-zinc-400">
        User
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setConfirmEmail("");
            setSuccess(false);
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

      {selectedUser ?
        <dl className="mt-4 grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{selectedUser.email}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">User ID</dt>
            <dd className="font-mono text-xs text-zinc-300">{selectedUser.id}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-300">
              {new Date(selectedUser.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      : null}

      <label className="mt-4 block text-xs font-medium text-zinc-400">
        Type the user&apos;s email to confirm
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          autoComplete="off"
          disabled={!selectedUser}
          placeholder={selectedUser?.email ?? ""}
          className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 transition focus:border-red-700 focus:ring-2 disabled:opacity-50"
        />
      </label>

      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-red-800/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 sm:w-auto"
        disabled={busy || !selectedUser || !emailMatches}
        onClick={() => void deleteUser()}
      >
        {busy ? "Deleting…" : "Delete user"}
      </button>
    </div>
  );
}
