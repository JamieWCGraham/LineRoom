import Link from "next/link";
import { AppBrandDash } from "@/components/app-brand";
import { NewPieceButton } from "@/components/dashboard/new-piece-button";
import { PieceRow } from "@/components/dashboard/piece-row";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { normalizeAuthUserToProfile } from "@/lib/auth/profile";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { SongRow } from "@/types/database";

type Props = {
  searchParams: Promise<{ createError?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const user = await getAuthenticatedUser();
  const { email } = normalizeAuthUserToProfile(user);

  const supabase = await createClient();
  const { data: songsRaw } = await supabase
    .from("songs")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const songs = (songsRaw ?? []) as Pick<SongRow, "id" | "title" | "updated_at">[];
  const q = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <AppBrandDash />

      <div className="mt-8">
        <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-200">{email}</span>
        </p>
      </div>

      {q.createError === "1" ?
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          Could not create a new piece. Check your connection and try again.
        </p>
      : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Your pieces
          </h2>
          <NewPieceButton />
        </div>

        {songs.length === 0 ?
          <p className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
            No pieces yet. Start with{" "}
            <span className="text-zinc-400">New piece</span> to open a saved
            LineRoom.
          </p>
        : <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {songs.map((s) => (
              <PieceRow
                key={s.id}
                songId={s.id}
                initialTitle={s.title}
                updatedAt={s.updated_at}
              />
            ))}
          </ul>
        }
      </section>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-zinc-800 pt-8">
        <Link
          href="/account"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Account
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
