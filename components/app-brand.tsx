/** Single source for product description (login, dashboard, editor header). */
export const APP_TAGLINE =
  "LineRoom is a modern workspace for songwriters to draft, shape, and refine lyrics in real time.";

export function AppBrandHero() {
  return (
    <header className="mb-10 text-center">
      <h1 className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
        LineRoom
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
        {APP_TAGLINE}
      </p>
    </header>
  );
}

export function AppBrandDash() {
  return (
    <div className="border-b border-zinc-800/80 pb-8">
      <p className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
        LineRoom
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
        {APP_TAGLINE}
      </p>
    </div>
  );
}
