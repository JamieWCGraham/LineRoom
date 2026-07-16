import Link from "next/link";
import { AppBrandHero } from "@/components/app-brand";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/guards";
import { isAnonymousUser } from "@/lib/auth/guest";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const canReset = Boolean(user && !isAnonymousUser(user));

  return (
    <div className="w-full max-w-md">
      <AppBrandHero />

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Reset password
        </h2>
        {canReset ? (
          <>
            <p className="mb-6 mt-1 text-center text-xs text-zinc-500">
              Choose a new password for your account.
            </p>
            <ResetPasswordForm />
          </>
        ) : (
          <>
            <p
              className="mb-6 mt-1 text-center text-sm text-red-300"
              role="alert"
            >
              This reset link is invalid or has expired. Request a new one from
              the forgot password page.
            </p>
            <p className="text-center text-sm text-zinc-500">
              <Link
                href="/forgot-password"
                prefetch
                className="text-zinc-300 underline"
              >
                Forgot password
              </Link>
              {" · "}
              <Link href="/login" prefetch className="text-zinc-300 underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
