export default function SongEditorLoading() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950">
      <div className="hidden shrink-0 border-b border-zinc-800/80 px-4 py-3 lg:block">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-800/50" />
        </div>
      </div>
      <div className="min-h-0 flex-1 animate-pulse bg-zinc-950 p-4">
        <div className="mx-auto h-full max-w-3xl rounded-lg border border-zinc-800/60 bg-zinc-900/30" />
      </div>
    </div>
  );
}
