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
    <form action={formAction} className="mx-auto max-w-md space-y-4">
      <div>
        <label htmlFor="display_name" className="mb-1 block text-sm text-zinc-400">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          defaultValue={profile?.display_name ?? ""}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="username" className="mb-1 block text-sm text-zinc-400">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={profile?.username ?? ""}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
        />
        {state?.fieldErrors?.username ? (
          <p className="mt-1 text-sm text-red-400">{state.fieldErrors.username}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="avatar_url" className="mb-1 block text-sm text-zinc-400">
          Avatar URL
        </label>
        <input
          id="avatar_url"
          name="avatar_url"
          type="url"
          defaultValue={profile?.avatar_url ?? ""}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
        />
      </div>
      {state?.message ? (
        <p className="text-sm text-red-400">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
