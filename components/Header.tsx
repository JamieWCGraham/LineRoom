import Link from "next/link";
import { APP_TAGLINE } from "@/components/app-brand";

export function Header(props: { showDashboardLink?: boolean }) {
  return (
    <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            LineRoom
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">{APP_TAGLINE}</p>
        </div>
        {props.showDashboardLink ?
          <Link
            href="/"
            className="shrink-0 text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Dashboard
          </Link>
        : null}
      </div>
    </header>
  );
}
