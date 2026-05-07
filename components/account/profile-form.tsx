"use client";

import { useActionState } from "react";
import {
  updateProfile,
  type ProfileFormState,
} from "@/lib/auth/actions";
import type { ProfileRow } from "@/types/database";

type Props = { profile: ProfileRow | null };

export function ProfileForm({ profile }: Props) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState | undefined,
    FormData
  >(updateProfile, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950/70">
        <label
          htmlFor="display_name"
          className="flex items-center justify-between gap-4 border-b border-zinc-700/60 px-3.5 py-3"
        >
          <span className="text-sm text-zinc-300">Display name</span>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={profile?.display_name ?? ""}
            className="w-2/3 bg-transparent text-right text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Add name"
          />
        </label>
        <label
          htmlFor="username"
          className="flex items-center justify-between gap-4 border-b border-zinc-700/60 px-3.5 py-3"
        >
          <span className="text-sm text-zinc-300">Username</span>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue={profile?.username ?? ""}
            className="w-2/3 bg-transparent text-right text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="@username"
          />
        </label>
        <label
          htmlFor="avatar_url"
          className="flex items-center justify-between gap-4 px-3.5 py-3"
        >
          <span className="text-sm text-zinc-300">Avatar URL</span>
          <input
            id="avatar_url"
            name="avatar_url"
            type="url"
            defaultValue={profile?.avatar_url ?? ""}
            className="w-2/3 bg-transparent text-right text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="https://"
          />
        </label>
      </div>
      {state?.fieldErrors?.username ? (
        <p className="text-sm text-red-400">{state.fieldErrors.username}</p>
      ) : null}
      {state?.message ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
