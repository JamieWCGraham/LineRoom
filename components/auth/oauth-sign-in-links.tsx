import { oauthStartHref, sanitizeAuthNext } from "@/lib/auth/oauth";

const btnBase =
  "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-50";

type Props = {
  /** Post-login path; only relative same-origin paths are honored. */
  nextPath?: string | string[] | null;
};

function pickNext(raw: Props["nextPath"]): string {
  if (raw == null) return "/";
  if (Array.isArray(raw)) return sanitizeAuthNext(raw[0]);
  return sanitizeAuthNext(raw);
}

export function OAuthSignInLinks({ nextPath }: Props) {
  const next = pickNext(nextPath);
  const googleHref = oauthStartHref("google", next);
  const appleHref = oauthStartHref("apple", next);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <a
          href={googleHref}
          className={`${btnBase} border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700`}
        >
          <GoogleGlyph className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Continue with Google
        </a>
        <a
          href={appleHref}
          className={`${btnBase} border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900`}
        >
          <AppleGlyph className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Continue with Apple
        </a>
      </div>
      <p className="text-center text-[11px] leading-snug text-zinc-600">
        You will sign in with your provider, then return here to finish.
      </p>
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.975 1.435-12.671.163-1.564-1.898-.25-3.675.873-1.124 1.89-1.99 3.123-1.99h.079zm4.97 15.62c-.747.977-1.563 1.888-2.503 1.888-.979 0-1.271-.585-2.345-.585-1.073 0-1.49.596-2.432.596-.943 0-1.675-.827-2.422-1.804-1.244-1.604-2.2-4.05-2.2-6.37 0-2.32.827-4.22 2.2-5.18 1.073-.827 1.99-1.271 2.827-1.271.827 0 1.675.493 2.345.493.827 0 1.675-.493 2.827-.493.827 0 1.675.444 2.503 1.271 1.073.827 1.99 2.32 1.99 4.22 0 2.32-.827 4.22-2.2 5.18z" />
    </svg>
  );
}
