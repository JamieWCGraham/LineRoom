"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthFormState } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(updatePassword, undefined);

  return (
    <div className="w-full space-y-4">
      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm text-zinc-400"
          >
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />
          {state?.fieldErrors?.password ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-sm text-zinc-400"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />
          {state?.fieldErrors?.confirmPassword ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {state.fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>
        {state?.message ? (
          <p className="text-sm text-red-400" role="alert">
            {state.message}{" "}
            <Link
              href="/forgot-password"
              prefetch
              className="text-zinc-300 underline"
            >
              Request a new link
            </Link>
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" prefetch className="text-zinc-300 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
