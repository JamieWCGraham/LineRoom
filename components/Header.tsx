export function Header() {
  return (
    <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto max-w-[1920px]">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
          LineRoom
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Draft lyrics, generate a structured critique, then chat with your song
          in full context.
        </p>
      </div>
    </header>
  );
}
