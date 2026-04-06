"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/lib/auth/actions";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(signup, undefined);

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
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
          <label
            htmlFor="password"
            className="mb-1 block text-sm text-zinc-400"
          >
            Password
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
            <p className="mt-1 text-sm text-red-400">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>
        {state?.message ? (
          <p className="text-sm text-amber-400">{state.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-950 px-2 text-zinc-500">Or</span>
        </div>
      </div>

      <OAuthButtons providers={["google"]} />

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-zinc-300 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
