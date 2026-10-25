import { AppBrandHero } from "@/components/app-brand";
import { SignupForm } from "@/components/auth/signup-form";
import { OAuthSignInLinks } from "@/components/auth/oauth-sign-in-links";
import { TrackOnMount } from "@/components/marketing/TrackOnMount";
import { oauthSignInUiEnabled } from "@/lib/auth/oauth";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const q = await searchParams;
  return (
    <div className="w-full max-w-md">
      <AppBrandHero />
      <TrackOnMount event="signup_started" props={{ source: "signup" }} />

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5 shadow-xl shadow-black/30 backdrop-blur-sm sm:p-6">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Create account
        </h2>
        <p className="mb-5 mt-1 text-center text-xs leading-relaxed text-zinc-500 sm:mb-6">
          Save pieces in the cloud and pick up where you left off.
        </p>
        {oauthSignInUiEnabled ? (
          <div className="hidden sm:block">
            <OAuthSignInLinks nextPath={q.next} />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-900/40 px-2 text-zinc-500">
                  Or use email
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <SignupForm />
      </div>
    </div>
  );
}
