import Link from "next/link";
import { AppBrandHero } from "@/components/app-brand";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthSignInLinks } from "@/components/auth/oauth-sign-in-links";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const q = await searchParams;

  return (
    <div className="w-full max-w-md">
      <AppBrandHero />

      {q.error === "oauth_callback" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Could not complete sign-in. Try again.
        </p>
      ) : null}
      {q.error === "oauth_provider" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Unknown sign-in provider. Use Google or Apple.
        </p>
      ) : null}
      {q.error === "confirm" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Email link invalid or expired. Request a new one or sign in.
        </p>
      ) : null}
      {q.error === "recovery" ? (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
          Password reset link invalid or expired.{" "}
          <Link href="/forgot-password" prefetch className="underline">
            Request a new one
          </Link>
          .
        </p>
      ) : null}
      {q.message === "signed_out" ? (
        <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-center text-sm text-zinc-400">
          You have been signed out.
        </p>
      ) : null}
      {q.message === "confirmed" ? (
        <p className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-center text-sm text-emerald-200">
          Check your email or sign in to continue.
        </p>
      ) : null}
      {q.reset === "1" ? (
        <p className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-center text-sm text-emerald-200">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Sign in
        </h2>
        <p className="mb-6 mt-1 text-center text-xs text-zinc-500">
          Access your saved pieces and the LineRoom editor.
        </p>
        <OAuthSignInLinks nextPath={q.next} />
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <span className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-zinc-900 px-2 text-zinc-500">
              Or use email
            </span>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
