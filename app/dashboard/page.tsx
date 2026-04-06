import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  const { email, auth_provider: authProvider } =
    normalizeAuthUserToProfile(user);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-200">{email}</span>
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Auth provider:{" "}
        <span className="text-zinc-300">{authProvider}</span>
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/account"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Account
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          LineRoom
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
