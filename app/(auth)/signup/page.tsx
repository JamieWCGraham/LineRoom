import { AppBrandHero } from "@/components/app-brand";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <AppBrandHero />

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Create account
        </h2>
        <p className="mb-6 mt-1 text-center text-xs text-zinc-500">
          Save pieces in the cloud and pick up where you left off.
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
