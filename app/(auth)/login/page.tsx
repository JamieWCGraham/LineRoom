import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

type Props = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const q = await searchParams;

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
        Sign in
      </h1>
      <p className="mb-8 text-center text-sm text-zinc-500">
        <Link href="/" className="text-zinc-400 underline hover:text-zinc-300">
          ← Back to LineRoom
        </Link>
      </p>
      {q.error === "oauth_callback" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Could not complete sign-in. Try again.
        </p>
      ) : null}
      {q.error === "confirm" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Email link invalid or expired. Request a new one or sign in.
        </p>
      ) : null}
      {q.message === "signed_out" ? (
        <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-center text-sm text-zinc-400">
          You have been signed out.
        </p>
      ) : null}
      {q.message === "confirmed" ? (
        <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-center text-sm text-amber-200">
          Check your email or sign in to continue.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
