import { AppBrandHero } from "@/components/app-brand";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <AppBrandHero />

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Forgot password
        </h2>
        <p className="mb-6 mt-1 text-center text-xs text-zinc-500">
          Enter your email and we&apos;ll send a link to reset your password.
        </p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
