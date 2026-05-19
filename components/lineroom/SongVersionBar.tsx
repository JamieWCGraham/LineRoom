import { SongTitleEditor } from "@/components/songs/song-title-editor";

export function SongVersionBar(props: {
  songId: string;
  initialSongTitle: string;
  onPieceTitleSaved: (title: string) => void;
  versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
  activeVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onSaveVersion: () => void;
  savePending: boolean;
  saveError: string | null;
  onNewVersion: () => void;
  newVersionPending: boolean;
  onDeleteVersion: () => void;
  deleteVersionPending: boolean;
  deleteVersionError: string | null;
  canDeleteActiveVersion: boolean;
  editorBusy: boolean;
  persistInFlight: boolean;
}) {
  return (
    <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <SongTitleEditor
            songId={props.songId}
            initialTitle={props.initialSongTitle}
            onTitleSaved={props.onPieceTitleSaved}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
            <span>Version</span>
            <select
              value={props.activeVersionId}
              onChange={(e) => props.onSelectVersion(e.target.value)}
              disabled={
                props.deleteVersionPending ||
                props.persistInFlight ||
                props.savePending ||
                props.newVersionPending ||
                props.editorBusy
              }
              className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-700/40 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {props.versions
                .slice()
                .sort((a, b) => b.versionNumber - a.versionNumber)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={props.onSaveVersion}
            disabled={
              props.savePending ||
              props.deleteVersionPending ||
              props.persistInFlight ||
              props.newVersionPending ||
              props.editorBusy
            }
            title="Save draft, workshop, and critique to the selected version now. Also happens automatically while you work."
            className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-400 disabled:opacity-50"
          >
            {props.savePending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={props.onNewVersion}
            disabled={
              props.savePending ||
              props.persistInFlight ||
              props.deleteVersionPending ||
              props.newVersionPending ||
              props.editorBusy
            }
            title="Save this version, then open a new numbered copy you can edit separately."
            className="shrink-0 rounded-lg border border-blue-800/40 bg-blue-950/35 px-3 py-1.5 text-xs font-medium text-blue-100/90 transition hover:border-blue-700/50 hover:bg-blue-900/30 disabled:opacity-50"
          >
            {props.newVersionPending ? "Creating…" : "New Version"}
          </button>
          <button
            type="button"
            onClick={props.onDeleteVersion}
            disabled={
              !props.canDeleteActiveVersion ||
              props.deleteVersionPending ||
              props.savePending ||
              props.persistInFlight ||
              props.newVersionPending ||
              props.editorBusy
            }
            className="shrink-0 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-200/95 transition hover:border-red-800/60 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {props.deleteVersionPending ? "Deleting…" : "Delete Version"}
          </button>
        </div>
      </div>
      {props.saveError ?
        <p className="mx-auto mt-2 max-w-[1920px] text-xs text-red-400">
          {props.saveError}
        </p>
      : null}
      {props.deleteVersionError ?
        <p className="mx-auto mt-2 max-w-[1920px] text-xs text-red-400">
          {props.deleteVersionError}
        </p>
      : null}
    </div>
  );
}
