"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type AuthFormState,
} from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(requestPasswordReset, undefined);

  return (
    <div className="w-full space-y-4">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-zinc-400">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />
          {state?.fieldErrors?.email ? (
            <p className="mt-1 text-sm text-red-400" role="alert">
              {state.fieldErrors.email}
            </p>
          ) : null}
        </div>
        {state?.message ? (
          <p className="text-sm text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        {state?.success ? (
          <p
            className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200"
            aria-live="polite"
          >
            {state.success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        Remembered your password?{" "}
        <Link href="/login" prefetch className="text-zinc-300 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
