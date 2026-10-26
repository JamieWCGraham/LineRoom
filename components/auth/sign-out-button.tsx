"use client";

import posthog from "posthog-js";
import { logout } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form
      action={logout}
      onSubmit={() => {
        if (
          process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
          process.env.NEXT_PUBLIC_POSTHOG_HOST
        ) {
          posthog.reset();
        }
      }}
    >
      <button
        type="submit"
        className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
