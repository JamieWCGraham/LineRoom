"use client";

import Link from "next/link";
import { DashboardBackLink } from "@/components/navigation/dashboard-back-link";
import { SignupPromptModal } from "@/components/billing/SignupPromptModal";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { CritiqueSetupPanel } from "@/components/CritiqueSetupPanel";
import {
  DraftRecordingsPanel,
} from "@/components/draft/DraftRecordingsPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { LyricChatPanel } from "@/components/LyricChatPanel";
import { GuestTryBanner } from "@/components/lineroom/GuestTryBanner";
import { GuestWorkflowTour } from "@/components/lineroom/GuestWorkflowTour";
import { SongTitleEditor } from "@/components/songs/song-title-editor";
import { SongVersionBar } from "@/components/lineroom/SongVersionBar";
import { ShareLyricsButton } from "@/components/songs/share-lyrics-button";
import { useGuestBannerMobileOffset } from "@/lib/hooks/useGuestBannerMobileOffset";
import { useGuestWorkflowTour } from "@/lib/hooks/useGuestWorkflowTour";
import {
  MOBILE_DOC_HEADER_BACK_BTN,
  MOBILE_DOC_HEADER_ICON_BTN,
  type LineRoomEditorViewModel,
} from "@/lib/hooks/useLineRoomEditorState";
import { useRef, type CSSProperties } from "react";

export function LineRoomEditorLayout({
  props,
  router,
  isSong,
  layout,
  fullText,
  setFullText,
  brainstormText,
  setBrainstormText,
  chatMessages,
  setChatMessages,
  critique,
  meta,
  setMeta,
  pieceTitle,
  setPieceTitle,
  saveError,
  deleteVersionError,
  newVersionPending,
  deleteVersionPending,
  savePending,
  startRouteTransition,
  songId,
  activeVersionId,
  lyricDraftEditorRef,
  voiceNotesRef,
  persist,
  critiqueFlow,
  lyricPaneTabs,
  lineFeedbackByIndex,
  lineFeedbackAutoShowKey,
  lyricsEmpty,
  handleDeleteVersion,
  handleSaveVersion,
  handleNewVersion,
  EMPTY_LINE_FEEDBACK,
}: LineRoomEditorViewModel) {

  const {
    mobilePane,
    setMobilePane,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobileTitleEditorOpen,
    setMobileTitleEditorOpen,
    lyricDocPane,
  } = layout;

  const {
    critiqueLoading,
    critiqueError,
    critiqueAccess,
    paywallOpen,
    setPaywallOpen,
    quotaBadge,
    requestCritique,
  } = critiqueFlow;

  const persistInFlight = persist.persistInFlight;
  const autosaveError = persist.autosaveError;
  const flushPersist = persist.flushPersist;
  const songProps = props.mode === "song" ? props : null;
  const isGuest = Boolean(critiqueAccess?.isAnonymous);
  const showGuestBanner = isGuest && !isSong;
  const guestBannerRef = useRef<HTMLDivElement>(null);
  const guestBannerMobileOffsetPx = useGuestBannerMobileOffset(
    guestBannerRef,
    showGuestBanner,
  );
  const guestTour = useGuestWorkflowTour({
    enabled: isGuest && !isSong,
    paused: paywallOpen,
    setMobilePane,
  });

  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-y-contain bg-zinc-950"
      style={
        {
          "--lineroom-mobile-top": `${guestBannerMobileOffsetPx}px`,
          ...(guestBannerMobileOffsetPx > 0 ?
            { "--lineroom-safe-top": "0px" }
          : {}),
        } as CSSProperties
      }
    >
      <div className="hidden lg:block">
        <Header showDashboardLink={isSong} />
      </div>
      {showGuestBanner ? <GuestTryBanner ref={guestBannerRef} /> : null}
      {songProps ?
        <div className="hidden lg:block">
        <SongVersionBar
          songId={songProps.songId}
          initialSongTitle={songProps.songTitle}
          onPieceTitleSaved={setPieceTitle}
          versions={songProps.versions}
          activeVersionId={songProps.activeVersionId}
          activeVersionNumber={songProps.activeVersionNumber}
          draftText={fullText}
          shareToken={songProps.initialShareToken}
          publishedFromVersionId={songProps.initialPublishedFromVersionId}
          publishedDraftText={songProps.initialPublishedDraftText}
          onSelectVersion={(versionId) => {
            startRouteTransition(() => {
              router.push(`/song/${songProps.songId}?v=${versionId}`);
            });
          }}
          onSaveVersion={handleSaveVersion}
          savePending={savePending}
          saveError={saveError}
          onNewVersion={handleNewVersion}
          newVersionPending={newVersionPending}
          onDeleteVersion={handleDeleteVersion}
          deleteVersionPending={deleteVersionPending}
          deleteVersionError={deleteVersionError}
          canDeleteActiveVersion={songProps.versions.length > 1}
          editorBusy={critiqueLoading || newVersionPending || savePending}
          persistInFlight={persistInFlight}
        />
        </div>
      : null}
      {isSong && autosaveError ? (
        <div
          role="alert"
          className="shrink-0 border-b border-red-900/50 bg-red-950/35 px-4 py-2 text-center text-xs text-red-200/95"
        >
          {autosaveError}
        </div>
      ) : null}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close mobile controls menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <aside className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-zinc-800/80 bg-zinc-950 shadow-2xl animate-in slide-in-from-bottom-6 duration-200 ease-out">
            <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 px-4 pb-3 pt-2 backdrop-blur-sm">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-700/80" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-medium text-zinc-100">LineRoom controls</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Manage version settings
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-4 top-4 rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80 active:bg-zinc-700/80"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {songProps ? (
              <div className="px-4 pb-6">
                <DashboardBackLink
                  className="mt-5 flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/70 active:bg-zinc-800/80"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>←</span>
                    Back to Dashboard
                  </span>
                </DashboardBackLink>
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileTitleEditorOpen(true)}
                      className="min-w-0 truncate text-left text-lg font-medium text-zinc-100 transition hover:text-zinc-50"
                    >
                      {pieceTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileTitleEditorOpen((v) => !v)}
                      className="shrink-0 rounded-md border border-zinc-700/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900/70 active:bg-zinc-800/80"
                    >
                      {mobileTitleEditorOpen ? "Done" : "Edit"}
                    </button>
                  </div>
                  {mobileTitleEditorOpen ? (
                    <div className="mt-3">
                      <SongTitleEditor
                        songId={songProps.songId}
                        initialTitle={songProps.songTitle}
                        onTitleSaved={(title) => {
                          setPieceTitle(title);
                          setMobileTitleEditorOpen(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Version
                  </p>
                  <select
                    value={songProps.activeVersionId}
                    onChange={(e) => {
                      setMobileMenuOpen(false);
                      startRouteTransition(() => {
                        router.push(`/song/${songProps.songId}?v=${e.target.value}`);
                      });
                    }}
                    disabled={
                      deleteVersionPending ||
                      savePending ||
                      persistInFlight ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="mt-3 h-11 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 text-sm text-zinc-100 focus:border-emerald-700/40 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {songProps.versions
                      .slice()
                      .sort((a, b) => b.versionNumber - a.versionNumber)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.versionNumber}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSaveVersion();
                    }}
                    disabled={
                      savePending ||
                      persistInFlight ||
                      deleteVersionPending ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="w-full rounded-lg bg-blue-700 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-600 active:bg-blue-700/90 disabled:opacity-50"
                  >
                    {savePending ? "Saving…" : "Save now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNewVersion();
                    }}
                    disabled={
                      savePending ||
                      persistInFlight ||
                      deleteVersionPending ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="w-full rounded-lg border border-blue-800/40 bg-blue-950/40 px-4 py-3 text-base font-medium text-blue-100/90 transition hover:border-blue-700/50 hover:bg-blue-900/35 active:bg-blue-900/45 disabled:opacity-50"
                  >
                    {newVersionPending ? "Creating Version..." : "New Version"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleDeleteVersion();
                    }}
                    disabled={
                      songProps.versions.length <= 1 ||
                      deleteVersionPending ||
                      savePending ||
                      persistInFlight ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="w-full rounded-lg border border-red-900/35 bg-transparent px-4 py-3 text-base font-medium text-[#E57373] transition hover:bg-red-950/20 active:bg-red-950/30 disabled:opacity-40"
                  >
                    {deleteVersionPending ? "Deleting..." : "Delete Version"}
                  </button>
                  <ShareLyricsButton
                    songId={songProps.songId}
                    activeVersionId={songProps.activeVersionId}
                    activeVersionNumber={songProps.activeVersionNumber}
                    draftText={fullText}
                    shareToken={songProps.initialShareToken}
                    publishedFromVersionId={songProps.initialPublishedFromVersionId}
                    publishedFromVersionNumber={
                      songProps.initialPublishedFromVersionId ?
                        (songProps.versions.find(
                          (v) => v.id === songProps.initialPublishedFromVersionId,
                        )?.versionNumber ?? null)
                      : null
                    }
                    publishedDraftText={songProps.initialPublishedDraftText}
                    disabled={
                      deleteVersionPending ||
                      savePending ||
                      persistInFlight ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    fullWidth
                    buttonClassName="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-4 py-3 text-base font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
      <main className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden overscroll-y-contain gap-6 p-4 pb-4 max-lg:gap-0 max-lg:overscroll-none max-lg:p-0 max-lg:pb-[calc(4.25rem+env(safe-area-inset-bottom))] max-lg:pt-2 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1.35fr)_minmax(240px,320px)] lg:gap-6 lg:p-6 lg:pb-6">
        <section className={`${mobilePane === "critique" ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-800/80 px-4 pt-4 max-lg:px-0 max-lg:pt-0 lg:min-h-0 lg:flex lg:border-r lg:border-t-0 lg:border-zinc-800/80 lg:px-0 lg:pr-5 lg:pt-0`}>
          {critique || critiqueLoading ?
            <CritiqueDisplayPanel
              critique={critique}
              loading={critiqueLoading}
              onRegenerate={() => requestCritique({ regenerate: true })}
              lyricsEmpty={lyricsEmpty}
              quotaBadge={quotaBadge}
              pieceTitle={pieceTitle}
              critiqueMeta={meta}
              onCritiqueMetaChange={setMeta}
            />
          : <CritiqueSetupPanel
              similarArtists={meta.similarArtists}
              genre={meta.genre}
              onSimilarArtistsChange={(similarArtists) =>
                setMeta((m) => ({ ...m, similarArtists }))
              }
              onGenreChange={(genre) => setMeta((m) => ({ ...m, genre }))}
              onGenerate={() => requestCritique()}
              loading={critiqueLoading}
              error={critiqueError}
              lyricsEmpty={lyricsEmpty}
              quotaBadge={quotaBadge}
            />
          }
        </section>

        <section
          data-tour-target="draft"
          className={`${mobilePane === "draft" ? "flex" : "hidden"} relative z-[1] min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden overscroll-y-contain max-lg:min-h-0 max-lg:flex-1 max-lg:px-0 lg:min-h-0 lg:flex`}
        >
          {lyricDocPane === "draft" ?
            <DraftEditor
              ref={lyricDraftEditorRef}
              value={fullText}
              onChange={setFullText}
              lineFeedbackByIndex={lineFeedbackByIndex}
              lineFeedbackAutoShowKey={lineFeedbackAutoShowKey}
              onPersistFlush={isSong ? flushPersist : undefined}
              externalMobileToolsTrigger
              mobileTopRow={
                <div className="flex w-full min-w-0 items-center gap-1.5">
                  {isSong ?
                    <DashboardBackLink
                      aria-label="Back to dashboard"
                      className={MOBILE_DOC_HEADER_BACK_BTN}
                    >
                      <span aria-hidden>←</span>
                    </DashboardBackLink>
                  : <Link
                      href="/lineroom"
                      prefetch
                      aria-label="Back to LineRoom"
                      className={MOBILE_DOC_HEADER_BACK_BTN}
                    >
                      <span aria-hidden>←</span>
                    </Link>
                  }
                  <div className="min-w-0 flex-1 pl-1.5">
                    {songProps ?
                      <SongTitleEditor
                        songId={songProps.songId}
                        initialTitle={pieceTitle}
                        onTitleSaved={setPieceTitle}
                        compact
                      />
                    : <p className="truncate text-sm font-semibold text-zinc-100">
                        {pieceTitle}
                      </p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => lyricDraftEditorRef.current?.toggleMobileTools()}
                    className={MOBILE_DOC_HEADER_ICON_BTN}
                    aria-label="Open or close draft tools"
                  >
                    <svg
                      className="size-[18px] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className={MOBILE_DOC_HEADER_ICON_BTN}
                    aria-label="Open mobile controls menu"
                  >
                    <span className="inline-flex flex-col gap-1" aria-hidden>
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                    </span>
                  </button>
                </div>
              }
              headerLeading={lyricPaneTabs}
              headerTrailing={
                <DraftRecordingsPanel
                  ref={voiceNotesRef}
                  storageMode={isSong ? "cloud" : "local"}
                  songId={songId ?? undefined}
                  versionId={activeVersionId ?? undefined}
                  recordings={meta.draftRecordings ?? []}
                  onRecordingsChange={(next) =>
                    setMeta((m) => ({
                      ...m,
                      draftRecordings: next.length ? next : undefined,
                    }))
                  }
                  useMobileVoiceFab
                  suppressMobileFloatingFab
                  mobileFabVisible={mobilePane === "draft"}
                  disabled={
                    savePending ||
                    persistInFlight ||
                    deleteVersionPending ||
                    newVersionPending ||
                    critiqueLoading
                  }
                />
              }
            />
          : <DraftEditor
              ref={lyricDraftEditorRef}
              value={brainstormText}
              onChange={setBrainstormText}
              lineFeedbackByIndex={EMPTY_LINE_FEEDBACK}
              lineFeedbackAutoShowKey=""
              showFeedbackToggle={false}
              copyButtonIdleLabel="Copy"
              placeholder="Write brainstorm material for your lyrics here..."
              textInputAriaLabel="Brainstorm notes"
              onPersistFlush={isSong ? flushPersist : undefined}
              externalMobileToolsTrigger
              mobileTopRow={
                <div className="flex w-full min-w-0 items-center gap-1.5">
                  {isSong ?
                    <DashboardBackLink
                      aria-label="Back to dashboard"
                      className={MOBILE_DOC_HEADER_BACK_BTN}
                    >
                      <span aria-hidden>←</span>
                    </DashboardBackLink>
                  : <Link
                      href="/lineroom"
                      prefetch
                      aria-label="Back to LineRoom"
                      className={MOBILE_DOC_HEADER_BACK_BTN}
                    >
                      <span aria-hidden>←</span>
                    </Link>
                  }
                  <div className="min-w-0 flex-1 pl-1.5">
                    {songProps ?
                      <SongTitleEditor
                        songId={songProps.songId}
                        initialTitle={pieceTitle}
                        onTitleSaved={setPieceTitle}
                        compact
                      />
                    : <p className="truncate text-sm font-semibold text-zinc-100">
                        {pieceTitle}
                      </p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => lyricDraftEditorRef.current?.toggleMobileTools()}
                    className={MOBILE_DOC_HEADER_ICON_BTN}
                    aria-label="Open or close draft tools"
                  >
                    <svg
                      className="size-[18px] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className={MOBILE_DOC_HEADER_ICON_BTN}
                    aria-label="Open mobile controls menu"
                  >
                    <span className="inline-flex flex-col gap-1" aria-hidden>
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                      <span className="h-0.5 w-4 rounded bg-zinc-200" />
                    </span>
                  </button>
                </div>
              }
              headerLeading={lyricPaneTabs}
              // bodyPrefix={
              //   <p className="px-3 pt-2.5 pb-1 text-xs leading-relaxed text-zinc-500">
              //   </p>
              // }
              headerTrailing={
                <DraftRecordingsPanel
                  ref={voiceNotesRef}
                  storageMode={isSong ? "cloud" : "local"}
                  songId={songId ?? undefined}
                  versionId={activeVersionId ?? undefined}
                  recordings={meta.draftRecordings ?? []}
                  onRecordingsChange={(next) =>
                    setMeta((m) => ({
                      ...m,
                      draftRecordings: next.length ? next : undefined,
                    }))
                  }
                  useMobileVoiceFab
                  suppressMobileFloatingFab
                  mobileFabVisible={mobilePane === "draft"}
                  disabled={
                    savePending ||
                    persistInFlight ||
                    deleteVersionPending ||
                    newVersionPending ||
                    critiqueLoading
                  }
                />
              }
            />
          }
        </section>

        <section className={`${mobilePane === "chat" ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-800/80 px-4 pt-4 max-lg:px-0 max-lg:pt-0 lg:min-h-0 lg:flex lg:border-l lg:border-t-0 lg:border-zinc-800/80 lg:px-0 lg:pl-5 lg:pt-0 lg:opacity-95`}>
          <LyricChatPanel
            fullText={fullText}
            pieceTitle={pieceTitle}
            messages={chatMessages}
            onMessagesChange={setChatMessages}
            onClearMessages={() => setChatMessages([])}
            critique={critique}
            critiqueMeta={meta}
            lockedForGuests={isGuest}
          />
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-[50] shrink-0 border-t border-zinc-800/80 bg-zinc-950/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex w-full max-w-[1920px] items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => setMobilePane("critique")}
            className={
              mobilePane === "critique" ?
                "min-w-0 flex-1 rounded-lg bg-zinc-100 px-2 py-2 text-sm font-medium text-zinc-900"
              : "min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-sm text-zinc-300"
            }
          >
            Critique
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("draft")}
            className={
              mobilePane === "draft" ?
                "min-w-0 flex-1 rounded-lg bg-zinc-100 px-2 py-2 text-sm font-medium text-zinc-900"
              : "min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-sm text-zinc-300"
            }
          >
            Draft
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("chat")}
            className={
              mobilePane === "chat" ?
                "min-w-0 flex-1 rounded-lg bg-zinc-100 px-2 py-2 text-sm font-medium text-zinc-900"
              : "min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-sm text-zinc-300"
            }
          >
            Workshop
          </button>
          {mobilePane === "draft" &&
          (lyricDocPane === "draft" || lyricDocPane === "brainstorm") ?
            <button
              type="button"
              onClick={() => voiceNotesRef.current?.openVoicePanel()}
              disabled={
                savePending ||
                persistInFlight ||
                deleteVersionPending ||
                newVersionPending ||
                critiqueLoading
              }
              title="Voice notes"
              aria-label={
                (meta.draftRecordings?.length ?? 0) > 0 ?
                  `Voice notes, ${meta.draftRecordings?.length ?? 0} saved`
                : "Open voice notes"
              }
              className="relative inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-2 text-emerald-100/95 transition hover:border-emerald-600/50 hover:bg-emerald-950/55 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
                <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 22h8" />
              </svg>
              {(meta.draftRecordings?.length ?? 0) > 0 ?
                <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold leading-none text-white ring-1 ring-zinc-950">
                  {(meta.draftRecordings?.length ?? 0) > 99 ?
                    "99+"
                  : (meta.draftRecordings?.length ?? 0)}
                </span>
              : null}
            </button>
          : null}
        </div>
      </div>
      {isGuest ?
        <SignupPromptModal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
        />
      : (
        <UpgradeModal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
        />
      )}
      <GuestWorkflowTour
        open={guestTour.open}
        step={guestTour.step}
        onNext={guestTour.next}
        onBack={guestTour.back}
        onDismiss={guestTour.dismiss}
      />
    </div>
  );
}
