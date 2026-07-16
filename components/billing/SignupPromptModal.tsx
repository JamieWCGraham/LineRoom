"use client";

import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Shown when a guest try user exhausts their critique quota. */
export function SignupPromptModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-prompt-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <h2
          id="signup-prompt-title"
          className="text-lg font-semibold text-zinc-100"
        >
          Sign up to keep writing
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          You&apos;ve used your free guest critiques. Create an account to get
          more feedback and save pieces across devices.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
          >
            Log in
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
