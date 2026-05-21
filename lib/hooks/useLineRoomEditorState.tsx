"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { LineRoomEditorProps } from "@/components/LineRoomEditor.types";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";
import { useCritiqueFlow } from "@/lib/hooks/useCritiqueFlow";
import { useLineRoomLayout } from "@/lib/hooks/useLineRoomLayout";
import { useLineRoomLocalStorage } from "@/lib/hooks/useLineRoomLocalStorage";
import { useSongPersist } from "@/lib/hooks/useSongPersist";
import {
  deleteSongVersion,
  saveNewSongVersion,
  updateSongVersionState,
} from "@/lib/songs/actions";
import { buildAutosavePayloadString } from "@/lib/songs/persist";
import type {
  ChatMessage,
  CritiqueMeta,
  CritiqueResult,
} from "@/lib/types";

const EMPTY_LINE_FEEDBACK = new Map<number, LineAnnotation[]>();

export const MOBILE_DOC_HEADER_BACK_BTN =
  "inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/60 text-base leading-none text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80";

export const MOBILE_DOC_HEADER_ICON_BTN =
  "inline-flex h-[42px] min-h-[42px] min-w-[42px] shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/80";

export function useLineRoomEditorState(props: LineRoomEditorProps) {
  const router = useRouter();
  const isSong = props.mode === "song";
  const layout = useLineRoomLayout();

  const [fullText, setFullText] = useState(
    isSong ? props.initialDraftText : "",
  );
  const [brainstormText, setBrainstormText] = useState(
    isSong ? props.initialBrainstormText : "",
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    isSong ? props.initialChatMessages : [],
  );
  const [critique, setCritique] = useState<CritiqueResult | null>(
    isSong ? props.initialCritique : null,
  );
  const [meta, setMeta] = useState<CritiqueMeta>(
    isSong ? props.initialMeta : { title: "", similarArtists: "", genre: "" },
  );
  const [pieceTitle, setPieceTitle] = useState(
    isSong ? props.songTitle : "Untitled piece",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteVersionError, setDeleteVersionError] = useState<string | null>(
    null,
  );
  const [newVersionPending, startNewVersionTransition] = useTransition();
  const [deleteVersionPending, startDeleteVersionTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const [, startRouteTransition] = useTransition();
  const [serverSubRevision, setServerSubRevision] = useState(
    isSong ? props.initialSaveSubRevision : 0,
  );

  const songId = isSong ? props.songId : null;
  const songTitleFromProps = props.mode === "song" ? props.songTitle : null;
  const activeVersionId = props.mode === "song" ? props.activeVersionId : null;
  const prefetchVersionsKey =
    isSong ? props.versions.map((v) => v.id).join(",") : "";

  const lyricDraftEditorRef = useRef<import("@/components/DraftEditor").DraftEditorHandle>(null);
  const voiceNotesRef =
    useRef<import("@/components/draft/DraftRecordingsPanel").DraftRecordingsPanelHandle>(null);

  useLineRoomLocalStorage({
    enabled: !isSong,
    fullText,
    brainstormText,
    chatMessages,
    critique,
    meta,
    setFullText,
    setBrainstormText,
    setChatMessages,
    setCritique,
    setMeta,
  });

  const persist = useSongPersist({
    enabled: isSong,
    songId,
    activeVersionId,
    serverSubRevision,
    onServerSubRevision: setServerSubRevision,
    draftText: fullText,
    brainstormText,
    chatMessages,
    critique,
    meta,
    flushTrigger: [layout.mobilePane, layout.lyricDocPane],
  });

  const priorVersionsContext = useMemo(
    () => (props.mode === "song" ? props.priorVersionsContext : []),
    [props],
  );

  const songCritiqueSource = useMemo(
    () =>
      props.mode === "song" ?
        {
          activeVersionNumber: props.activeVersionNumber,
          initialDraftText: props.initialDraftText,
          initialCritique: props.initialCritique,
        }
      : null,
    [props],
  );

  const critiqueFlow = useCritiqueFlow({
    isSong,
    songId,
    activeVersionId,
    serverSubRevision,
    onServerSubRevision: setServerSubRevision,
    fullText,
    brainstormText,
    chatMessages,
    critique,
    meta,
    pieceTitle,
    priorVersionsContext,
    songCritiqueSource,
    persistSongState: persist.persistSongState,
    setVersionRowPersistLock: persist.setVersionRowPersistLock,
    markLastPersisted: persist.markLastPersisted,
    setSaveError,
    setCritique,
  });

  useEffect(() => {
    if (songTitleFromProps === null) return;
    setPieceTitle(songTitleFromProps);
  }, [songTitleFromProps]);

  useEffect(() => {
    setMeta((m) => ({ ...m, title: pieceTitle }));
  }, [pieceTitle]);

  useEffect(() => {
    if (!isSong) {
      router.prefetch("/");
      router.prefetch("/account");
      return;
    }
    if (!songId) return;
    for (const v of props.versions) {
      router.prefetch(`/song/${songId}?v=${v.id}`);
    }
    router.prefetch("/account");
    router.prefetch("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSong, router, songId, prefetchVersionsKey]);

  const lyricPaneTabs = useMemo(
    () => (
      <div
        className="flex min-w-0 items-baseline gap-1 text-xs font-medium uppercase tracking-wide"
        role="tablist"
        aria-label="Lyrics document"
      >
        <button
          type="button"
          role="tab"
          aria-selected={layout.lyricDocPane === "draft"}
          onClick={() => layout.setLyricDocPane("draft")}
          className={
            layout.lyricDocPane === "draft" ?
              "shrink-0 rounded-sm border-b border-zinc-400/90 pb-0.5 text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-emerald-600/35"
            : "shrink-0 rounded-sm border-b border-transparent pb-0.5 text-zinc-500 outline-none transition hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-emerald-600/35"
          }
        >
          DRAFT
        </button>
        <span className="shrink-0 select-none text-zinc-600" aria-hidden>
          ·
        </span>
        <button
          type="button"
          role="tab"
          aria-selected={layout.lyricDocPane === "brainstorm"}
          onClick={() => layout.setLyricDocPane("brainstorm")}
          className={
            layout.lyricDocPane === "brainstorm" ?
              "shrink-0 rounded-sm border-b border-zinc-400/90 pb-0.5 text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-emerald-600/35"
            : "shrink-0 rounded-sm border-b border-transparent pb-0.5 text-zinc-500 outline-none transition hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-emerald-600/35"
          }
        >
          BRAINSTORM
        </button>
      </div>
    ),
    [layout.lyricDocPane, layout.setLyricDocPane],
  );

  const lineFeedbackByIndex = useMemo(
    () =>
      critique ?
        buildLineFeedbackByIndex(fullText, critique.lineFeedback)
      : EMPTY_LINE_FEEDBACK,
    [critique, fullText],
  );

  const lineFeedbackAutoShowKey = useMemo(
    () =>
      critique?.lineFeedback?.length ?
        JSON.stringify(critique.lineFeedback)
      : "",
    [critique],
  );

  const lyricsEmpty = !fullText.trim();

  const handleDeleteVersion = useCallback(() => {
    if (!isSong || !songId || !activeVersionId) return;
    if (props.mode !== "song" || props.versions.length <= 1) return;
    const active = props.versions.find((v) => v.id === activeVersionId);
    const label = active ? `Version ${active.versionNumber}` : "this version";
    if (
      !window.confirm(
        `Delete ${label}? Its draft, brainstorm notes, workshop, and critique will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleteVersionError(null);
    persist.setVersionRowPersistLock(true);
    startDeleteVersionTransition(async () => {
      const result = await deleteSongVersion(songId, activeVersionId);
      if (!result.ok) {
        persist.setVersionRowPersistLock(false);
        setDeleteVersionError(result.message);
        return;
      }
      router.replace(`/song/${songId}?v=${result.fallbackVersionId}`);
      await router.refresh();
    });
  }, [
    activeVersionId,
    isSong,
    persist,
    props,
    router,
    songId,
    startDeleteVersionTransition,
  ]);

  const handleSaveVersion = useCallback(() => {
    if (!songId || !activeVersionId) return;
    setSaveError(null);
    startSaveTransition(async () => {
      await persist.waitForPersistChain();
      const payload = {
        draft_text: fullText,
        brainstorm_text: brainstormText,
        chat_messages: chatMessages,
        critique,
        meta,
      };
      const result = await updateSongVersionState(songId, activeVersionId, payload, {
        expectedSubRevision: serverSubRevision,
      });
      if (!result.ok) {
        setSaveError(result.message);
        if (result.reason === "stale") {
          persist.setPersistPaused(true);
          if (typeof result.currentSubRevision === "number") {
            setServerSubRevision(result.currentSubRevision);
          }
        }
        return;
      }
      setServerSubRevision(result.newSubRevision);
      persist.markLastPersisted(buildAutosavePayloadString({
        draftText: fullText,
        brainstormText,
        chatMessages,
        critique,
        meta,
      }));
      persist.setAutosaveError(null);
      await router.refresh();
    });
  }, [
    activeVersionId,
    brainstormText,
    chatMessages,
    critique,
    fullText,
    meta,
    persist,
    router,
    serverSubRevision,
    songId,
    startSaveTransition,
  ]);

  const handleNewVersion = useCallback(() => {
    if (!songId || !activeVersionId) return;
    setSaveError(null);
    persist.setVersionRowPersistLock(true);
    startNewVersionTransition(async () => {
      try {
        const payload = {
          draft_text: fullText,
          brainstorm_text: brainstormText,
          chat_messages: chatMessages,
          critique,
          meta,
        };
        const saveCurrentResult = await updateSongVersionState(
          songId,
          activeVersionId,
          payload,
          { expectedSubRevision: serverSubRevision },
        );
        if (!saveCurrentResult.ok) {
          setSaveError(saveCurrentResult.message);
          return;
        }
        setServerSubRevision(saveCurrentResult.newSubRevision);
        persist.markLastPersisted(buildAutosavePayloadString({
          draftText: fullText,
          brainstormText,
          chatMessages,
          critique,
          meta,
        }));
        const bumpResult = await saveNewSongVersion(songId, payload);
        if (!bumpResult.ok) {
          setSaveError(bumpResult.message);
          return;
        }
        router.replace(`/song/${songId}?v=${bumpResult.versionId}`);
        await router.refresh();
      } finally {
        persist.setVersionRowPersistLock(false);
      }
    });
  }, [
    activeVersionId,
    brainstormText,
    chatMessages,
    critique,
    fullText,
    meta,
    persist,
    router,
    serverSubRevision,
    songId,
    startNewVersionTransition,
  ]);

  const editorBusyForSave =
    savePending ||
    deleteVersionPending ||
    newVersionPending ||
    critiqueFlow.critiqueLoading ||
    persist.persistInFlight;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveShortcut =
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === "s" || e.key === "S");
      if (!isSaveShortcut) return;
      e.preventDefault();
      if (!isSong) return;
      if (editorBusyForSave) return;
      handleSaveVersion();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorBusyForSave, handleSaveVersion, isSong]);

  return {
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
    setCritique,
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
    priorVersionsContext,
    critiqueFlow,
    lyricPaneTabs,
    lineFeedbackByIndex,
    lineFeedbackAutoShowKey,
    lyricsEmpty,
    handleDeleteVersion,
    handleSaveVersion,
    handleNewVersion,
    editorBusyForSave,
    EMPTY_LINE_FEEDBACK,
  };
}

export type LineRoomEditorViewModel = ReturnType<typeof useLineRoomEditorState>;
