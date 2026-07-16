"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(login, undefined);

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
            <p className="mt-1 text-sm text-red-400">{state.fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="password" className="block text-sm text-zinc-400">
              Password
            </label>
            <Link
              href="/forgot-password"
              prefetch
              className="text-xs text-zinc-400 underline hover:text-zinc-300"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />
          {state?.fieldErrors?.password ? (
            <p className="mt-1 text-sm text-red-400">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>
        {state?.message ? (
          <p className="text-sm text-red-400">{state.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/signup" prefetch className="text-zinc-300 underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
