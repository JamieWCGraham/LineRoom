import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ createError?: string }>;
};

/** Kept for bookmarks; use `/` as the dashboard. */
export default async function DashboardAliasPage({ searchParams }: Props) {
  const q = await searchParams;
  if (q.createError === "1") {
    redirect("/?createError=1");
  }
  redirect("/");
}
