import { logout } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
