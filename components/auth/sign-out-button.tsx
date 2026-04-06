import { logout } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
      >
        Sign out
      </button>
    </form>
  );
}
