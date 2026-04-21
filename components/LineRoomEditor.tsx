"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { CritiqueAccessState } from "@/lib/billing/types";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { CritiqueSetupPanel } from "@/components/CritiqueSetupPanel";
import { DraftRecordingsPanel } from "@/components/draft/DraftRecordingsPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { LyricChatPanel } from "@/components/LyricChatPanel";
import { SongTitleEditor } from "@/components/songs/song-title-editor";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";

const EMPTY_LINE_FEEDBACK = new Map<number, LineAnnotation[]>();
import {
  deleteSongVersion,
  saveNewSongVersion,
  updateSongVersionState,
} from "@/lib/songs/actions";
import type {
  ChatMessage,
  CritiqueMeta,
  CritiqueResult,
  DraftRecordingMeta,
  PriorVersionContext,
} from "@/lib/types";
import type { ChatSelectionPayload, DraftEditorContext } from "@/types/chat";
import { critiqueResultSchema } from "@/lib/validators";

const LS_DRAFT = "lineroom_draft";
const LS_BRAINSTORM = "lineroom_brainstorm";
const LS_CHAT = "lineroom_chat_messages";
const LS_CRITIQUE = "lineroom_critique";
const LS_META = "lineroom_critique_meta";

function parseCritique(raw: string | null): CritiqueResult | null {
  if (raw === null) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    const p = critiqueResultSchema.safeParse(j);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

function parseLocalRecording(item: unknown): DraftRecordingMeta | null {
  if (typeof item !== "object" || item === null) return null;
  const r = item as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    typeof r.objectPath !== "string" ||
    typeof r.mimeType !== "string" ||
    typeof r.createdAt !== "string"
  ) {
    return null;
  }
  const rec: DraftRecordingMeta = {
    id: r.id,
    name: r.name,
    objectPath: r.objectPath,
    mimeType: r.mimeType,
    createdAt: r.createdAt,
  };
  if (typeof r.durationSec === "number") rec.durationSec = r.durationSec;
  return rec;
}

function parseMeta(raw: string | null): CritiqueMeta {
  const empty: CritiqueMeta = { title: "", similarArtists: "", genre: "" };
  if (raw === null) return empty;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const draftRecordings = Array.isArray(j.draftRecordings) ?
      j.draftRecordings
        .map(parseLocalRecording)
        .filter((x): x is DraftRecordingMeta => x !== null)
    : [];
    return {
      title: typeof j.title === "string" ? j.title : "",
      similarArtists:
        typeof j.similarArtists === "string" ? j.similarArtists : "",
      genre: typeof j.genre === "string" ? j.genre : "",
      draftRecordings:
        draftRecordings.length ? draftRecordings : undefined,
    };
  } catch {
    return empty;
  }
}

type LocalProps = { mode: "local" };

type SongProps = {
  mode: "song";
  songId: string;
  songTitle: string;
  versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
  priorVersionsContext: PriorVersionContext[];
  activeVersionNumber: number;
  activeVersionId: string;
  initialDraftText: string;
  initialBrainstormText: string;
  initialChatMessages: ChatMessage[];
  initialCritique: CritiqueResult | null;
  initialMeta: CritiqueMeta;
};

export type LineRoomEditorProps = LocalProps | SongProps;
type MobilePane = "draft" | "chat" | "critique";
type LyricDocPane = "draft" | "brainstorm";

function SongVersionBar(props: {
  songId: string;
  initialSongTitle: string;
  onPieceTitleSaved: (title: string) => void;
  versions: SongProps["versions"];
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
}) {
  const active = props.versions.find((v) => v.id === props.activeVersionId);
  return (
    <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <SongTitleEditor
            songId={props.songId}
            initialTitle={props.initialSongTitle}
            onTitleSaved={props.onPieceTitleSaved}
          />
          <p className="mt-2 text-xs text-zinc-500">
            {active ?
              `Version ${active.versionNumber} · ${new Date(active.createdAt).toLocaleString()}`
            : "Versions"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
            <span>Version</span>
            <select
              value={props.activeVersionId}
              onChange={(e) => props.onSelectVersion(e.target.value)}
              disabled={
                props.deleteVersionPending ||
                props.savePending ||
                props.newVersionPending ||
                props.editorBusy
              }
              className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-100 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:cursor-not-allowed disabled:opacity-50"
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
              props.newVersionPending ||
              props.editorBusy
            }
            title="Save draft, chat, and critique to the selected version. Does not create a new version."
            className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-400 disabled:opacity-50"
          >
            {props.savePending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={props.onNewVersion}
            disabled={
              props.savePending ||
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

export function LineRoomEditor(props: LineRoomEditorProps) {
  const router = useRouter();
  const isSong = props.mode === "song";

  const [fullText, setFullText] = useState(
    isSong ? props.initialDraftText : "",
  );
  const [brainstormText, setBrainstormText] = useState(
    isSong ? props.initialBrainstormText : "",
  );
  const [lyricDocPane, setLyricDocPane] = useState<LyricDocPane>("draft");
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
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteVersionError, setDeleteVersionError] = useState<string | null>(
    null,
  );
  const [savePending, startSaveTransition] = useTransition();
  const [newVersionPending, startNewVersionTransition] = useTransition();
  const [deleteVersionPending, startDeleteVersionTransition] = useTransition();
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("draft");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTitleEditorOpen, setMobileTitleEditorOpen] = useState(false);
  const [draftContext, setDraftContext] = useState<DraftEditorContext>({
    selection: null,
    caretLine: 0,
  });
  const [chatPinnedSelections, setChatPinnedSelections] = useState<
    ChatSelectionPayload[]
  >([]);
  const [critiqueAccess, setCritiqueAccess] = useState<CritiqueAccessState | null>(
    null,
  );
  const [paywallOpen, setPaywallOpen] = useState(false);

  const songId = isSong ? props.songId : null;
  const songTitleFromProps = props.mode === "song" ? props.songTitle : null;
  const activeVersionId = props.mode === "song" ? props.activeVersionId : null;

  /** Keeps latest row id for races with in-flight autosave. */
  const activeVersionIdRef = useRef<string | null>(null);
  /**
   * When true, autosave must not UPDATE any version row (prevents clobbering the
   * previous snapshot after saveNewSongVersion inserts a new row).
   */
  const versionRowPersistLockRef = useRef(false);

  useEffect(() => {
    activeVersionIdRef.current = activeVersionId;
  }, [activeVersionId]);
  const priorVersionsContext = useMemo(
    () => (props.mode === "song" ? props.priorVersionsContext : []),
    [props],
  );

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
          aria-selected={lyricDocPane === "draft"}
          onClick={() => setLyricDocPane("draft")}
          className={
            lyricDocPane === "draft" ?
              "shrink-0 rounded-sm border-b border-zinc-400/90 pb-0.5 text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-600/35"
            : "shrink-0 rounded-sm border-b border-transparent pb-0.5 text-zinc-500 outline-none transition hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-amber-600/35"
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
          aria-selected={lyricDocPane === "brainstorm"}
          onClick={() => setLyricDocPane("brainstorm")}
          className={
            lyricDocPane === "brainstorm" ?
              "shrink-0 rounded-sm border-b border-zinc-400/90 pb-0.5 text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-600/35"
            : "shrink-0 rounded-sm border-b border-transparent pb-0.5 text-zinc-500 outline-none transition hover:text-zinc-400 focus-visible:ring-1 focus-visible:ring-amber-600/35"
          }
        >
          BRAINSTORM
        </button>
      </div>
    ),
    [lyricDocPane],
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
    [
      props,
    ],
  );

  const quotaBadge = useMemo(() => {
    if (!critiqueAccess) return null;
    if (critiqueAccess.hasActiveSubscription) return "Pro";
    if (critiqueAccess.isBypassed) return null;
    return `Free: ${critiqueAccess.remainingFreeCritiques} left`;
  }, [critiqueAccess]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/access");
        const data = (await res.json()) as { access?: CritiqueAccessState };
        if (!cancelled && data.access) setCritiqueAccess(data.access);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (songTitleFromProps === null) return;
    setPieceTitle(songTitleFromProps);
  }, [songTitleFromProps]);

  useEffect(() => {
    setMeta((m) => ({ ...m, title: pieceTitle }));
  }, [pieceTitle]);

  useEffect(() => {
    setChatPinnedSelections((prev) =>
      prev.filter((p) => p.text.trim() && fullText.includes(p.text)),
    );
  }, [fullText]);

  useEffect(() => {
    if (props.mode === "song") return;
    try {
      const d = localStorage.getItem(LS_DRAFT);
      const c = localStorage.getItem(LS_CHAT);
      const cr = localStorage.getItem(LS_CRITIQUE);
      const m = localStorage.getItem(LS_META);
      if (d !== null) setFullText(d);
      const b = localStorage.getItem(LS_BRAINSTORM);
      if (b !== null) setBrainstormText(b);
      if (c !== null) {
        const parsed = JSON.parse(c) as unknown;
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(
            (msg): msg is ChatMessage =>
              typeof msg === "object" &&
              msg !== null &&
              (msg.role === "user" || msg.role === "assistant") &&
              typeof msg.content === "string",
          );
          setChatMessages(restored);
        }
      }
      setCritique(parseCritique(cr));
      setMeta(parseMeta(m));
    } catch {
      /* ignore */
    }
  }, [props.mode]);

  useEffect(() => {
    if (isSong) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_DRAFT, fullText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [fullText, isSong]);

  useEffect(() => {
    if (isSong) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_BRAINSTORM, brainstormText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [brainstormText, isSong]);

  useEffect(() => {
    if (isSong) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_CHAT, JSON.stringify(chatMessages));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [chatMessages, isSong]);

  useEffect(() => {
    if (isSong) return;
    const t = setTimeout(() => {
      try {
        if (critique) {
          localStorage.setItem(LS_CRITIQUE, JSON.stringify(critique));
        } else {
          localStorage.removeItem(LS_CRITIQUE);
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [critique, isSong]);

  useEffect(() => {
    if (isSong) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_META, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [meta, isSong]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const lineFeedbackByIndex = useMemo(
    () =>
      critique ?
        buildLineFeedbackByIndex(fullText, critique.lineFeedback)
      : new Map<number, LineAnnotation[]>(),
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

  const autosavePayload = useMemo(
    () =>
      JSON.stringify({
        draft_text: fullText,
        brainstorm_text: brainstormText,
        chat_messages: chatMessages,
        critique,
        meta,
      }),
    [brainstormText, chatMessages, critique, fullText, meta],
  );

  const persistSongState = useCallback(
    async (nextCritique?: CritiqueResult | null) => {
      if (!isSong) return;
      if (versionRowPersistLockRef.current) return;
      const versionIdAtStart = activeVersionIdRef.current;
      if (!songId || !versionIdAtStart) return;
      setAutosaveError(null);
      const payload = {
        draft_text: fullText,
        brainstorm_text: brainstormText,
        chat_messages: chatMessages,
        critique: nextCritique === undefined ? critique : nextCritique,
        meta,
      };
      if (versionRowPersistLockRef.current) return;
      if (activeVersionIdRef.current !== versionIdAtStart) return;
      const result = await updateSongVersionState(
        songId,
        versionIdAtStart,
        payload,
      );
      if (
        versionRowPersistLockRef.current ||
        activeVersionIdRef.current !== versionIdAtStart
      ) {
        return;
      }
      if (!result.ok) {
        setAutosaveError(result.message);
      }
    },
    [brainstormText, chatMessages, critique, fullText, isSong, meta, songId],
  );

  useEffect(() => {
    if (!isSong) return;

    const t = setTimeout(() => {
      void persistSongState();
    }, 1000);

    return () => clearTimeout(t);
  }, [autosavePayload, isSong, persistSongState]);

  const runCritique = useCallback(
    async (options?: { regenerate?: boolean }) => {
      const regenerate = options?.regenerate ?? false;
      if (!fullText.trim()) return;
      const priorCritiqueForPayload =
        regenerate && critique ? critique : undefined;

      const priorVersionsPayload =
        isSong && songCritiqueSource ?
          priorVersionsContext.length > 0 ?
            priorVersionsContext
          : regenerate ?
            [
              {
                versionNumber: songCritiqueSource.activeVersionNumber,
                draftText: songCritiqueSource.initialDraftText,
                critique: songCritiqueSource.initialCritique,
              },
            ]
          : []
        : [];

      const analyzedSongVersion =
        isSong && songCritiqueSource ?
          songCritiqueSource.activeVersionNumber
        : undefined;
      const priorSongVersionCompared =
        isSong ?
          priorVersionsContext.length > 0 ?
            priorVersionsContext[0]!.versionNumber
          : null
        : undefined;

      setCritiqueError(null);
      setSaveError(null);
      setCritiqueLoading(true);
      try {
        const res = await fetch("/api/critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullText,
            title: pieceTitle,
            similarArtists: meta.similarArtists,
            genre: meta.genre,
            priorVersions: priorVersionsPayload,
            regenerate: regenerate || undefined,
            priorCritique: priorCritiqueForPayload,
            analyzedSongVersion,
            priorSongVersionCompared,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          critique?: CritiqueResult;
          access?: CritiqueAccessState;
          code?: string;
        };
        if (data.access) setCritiqueAccess(data.access);
        if (res.status === 402 && data.code === "PAYWALL_REQUIRED") {
          setCritiqueError(null);
          setPaywallOpen(true);
          return;
        }
        if (!res.ok) {
          setCritiqueError(
            typeof data.error === "string" ? data.error : "Critique failed.",
          );
          return;
        }
        if (!data.critique) {
          setCritiqueError("Missing critique in response.");
          return;
        }

        const nextCritique = data.critique;
        setCritique(nextCritique);

        if (isSong && songId && activeVersionId) {
          versionRowPersistLockRef.current = true;
          const payload = {
            draft_text: fullText,
            brainstorm_text: brainstormText,
            chat_messages: chatMessages,
            critique: nextCritique,
            meta,
          };
          const saveCurrentResult = await updateSongVersionState(
            songId,
            activeVersionId,
            payload,
          );
          if (!saveCurrentResult.ok) {
            versionRowPersistLockRef.current = false;
            setSaveError(saveCurrentResult.message);
            return;
          }
          const bumpResult = await saveNewSongVersion(songId, payload);
          if (!bumpResult.ok) {
            versionRowPersistLockRef.current = false;
            setSaveError(bumpResult.message);
            return;
          }
          router.replace(`/song/${songId}?v=${bumpResult.versionId}`);
          await router.refresh();
        } else {
          await persistSongState(nextCritique);
        }
      } catch {
        setCritiqueError("Network error.");
      } finally {
        setCritiqueLoading(false);
      }
    },
    [
      activeVersionId,
      brainstormText,
      chatMessages,
      critique,
      fullText,
      isSong,
      meta,
      persistSongState,
      pieceTitle,
      priorVersionsContext,
      router,
      songCritiqueSource,
      songId,
    ],
  );

  const requestCritique = useCallback(
    (opts?: { regenerate?: boolean }) => {
      if (critiqueAccess && !critiqueAccess.canGenerateCritique) {
        setPaywallOpen(true);
        return;
      }
      void runCritique(opts);
    },
    [critiqueAccess, runCritique],
  );

  const handleDeleteVersion = useCallback(() => {
    if (!isSong || !songId || !activeVersionId) return;
    if (props.mode !== "song" || props.versions.length <= 1) return;
    const active = props.versions.find((v) => v.id === activeVersionId);
    const label = active ? `Version ${active.versionNumber}` : "this version";
    if (
      !window.confirm(
        `Delete ${label}? Its draft, brainstorm notes, chat, and critique will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleteVersionError(null);
    versionRowPersistLockRef.current = true;
    startDeleteVersionTransition(async () => {
      const result = await deleteSongVersion(songId, activeVersionId);
      if (!result.ok) {
        versionRowPersistLockRef.current = false;
        setDeleteVersionError(result.message);
        return;
      }
      router.replace(`/song/${songId}?v=${result.fallbackVersionId}`);
      await router.refresh();
    });
  }, [
    activeVersionId,
    isSong,
    props,
    router,
    songId,
    startDeleteVersionTransition,
  ]);

  const handleSaveVersion = useCallback(() => {
    if (!songId || !activeVersionId) return;
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await updateSongVersionState(songId, activeVersionId, {
        draft_text: fullText,
        brainstorm_text: brainstormText,
        chat_messages: chatMessages,
        critique,
        meta,
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      await router.refresh();
    });
  }, [
    activeVersionId,
    brainstormText,
    chatMessages,
    critique,
    fullText,
    meta,
    router,
    songId,
  ]);

  const handleNewVersion = useCallback(() => {
    if (!songId || !activeVersionId) return;
    setSaveError(null);
    versionRowPersistLockRef.current = true;
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
        );
        if (!saveCurrentResult.ok) {
          setSaveError(saveCurrentResult.message);
          return;
        }
        const bumpResult = await saveNewSongVersion(songId, payload);
        if (!bumpResult.ok) {
          setSaveError(bumpResult.message);
          return;
        }
        router.replace(`/song/${songId}?v=${bumpResult.versionId}`);
        await router.refresh();
      } finally {
        versionRowPersistLockRef.current = false;
      }
    });
  }, [
    activeVersionId,
    brainstormText,
    chatMessages,
    critique,
    fullText,
    meta,
    router,
    songId,
  ]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-y-contain bg-zinc-950">
      <div className="hidden lg:block">
        <Header showDashboardLink={isSong} />
      </div>
      {isSong ?
        <div className="hidden lg:block">
        <SongVersionBar
          songId={props.songId}
          initialSongTitle={props.songTitle}
          onPieceTitleSaved={setPieceTitle}
          versions={props.versions}
          activeVersionId={props.activeVersionId}
          onSelectVersion={(versionId) => router.push(`/song/${props.songId}?v=${versionId}`)}
          onSaveVersion={handleSaveVersion}
          savePending={savePending}
          saveError={saveError}
          onNewVersion={handleNewVersion}
          newVersionPending={newVersionPending}
          onDeleteVersion={handleDeleteVersion}
          deleteVersionPending={deleteVersionPending}
          deleteVersionError={deleteVersionError}
          canDeleteActiveVersion={props.versions.length > 1}
          editorBusy={critiqueLoading || newVersionPending}
        />
        </div>
      : null}
      {isSong && autosaveError ? (
        <div className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">
          Autosave failed: {autosaveError}
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

            {isSong ? (
              <div className="px-4 pb-6">
                <Link
                  href="/"
                  prefetch
                  className="mt-5 flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/70 active:bg-zinc-800/80"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>←</span>
                    Back to Dashboard
                  </span>
                </Link>
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
                        songId={props.songId}
                        initialTitle={props.songTitle}
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
                    value={props.activeVersionId}
                    onChange={(e) => {
                      setMobileMenuOpen(false);
                      router.push(`/song/${props.songId}?v=${e.target.value}`);
                    }}
                    disabled={
                      deleteVersionPending ||
                      savePending ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="mt-3 h-11 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 text-sm text-zinc-100 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:cursor-not-allowed disabled:opacity-50"
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
                      deleteVersionPending ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="w-full rounded-lg bg-blue-700 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-600 active:bg-blue-700/90 disabled:opacity-50"
                  >
                    {savePending ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNewVersion();
                    }}
                    disabled={
                      savePending ||
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
                      props.versions.length <= 1 ||
                      deleteVersionPending ||
                      savePending ||
                      newVersionPending ||
                      critiqueLoading
                    }
                    className="w-full rounded-lg border border-red-900/35 bg-transparent px-4 py-3 text-base font-medium text-[#E57373] transition hover:bg-red-950/20 active:bg-red-950/30 disabled:opacity-40"
                  >
                    {deleteVersionPending ? "Deleting..." : "Delete Version"}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
      <main className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden overscroll-y-contain gap-6 p-4 pb-4 max-lg:gap-0 max-lg:overscroll-none max-lg:p-0 max-lg:pb-[calc(4.75rem+env(safe-area-inset-bottom))] max-lg:pt-2 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1.35fr)_minmax(240px,320px)] lg:gap-6 lg:p-6 lg:pb-6">
        <section className={`${mobilePane === "critique" ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-800/80 px-4 pt-4 max-lg:px-0 max-lg:pt-0 lg:min-h-0 lg:flex lg:border-r lg:border-t-0 lg:border-zinc-800/80 lg:px-0 lg:pr-5 lg:pt-0`}>
          {critique || critiqueLoading ?
            <CritiqueDisplayPanel
              critique={critique}
              loading={critiqueLoading}
              onRegenerate={() => requestCritique({ regenerate: true })}
              lyricsEmpty={lyricsEmpty}
              quotaBadge={quotaBadge}
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

        <section className={`${mobilePane === "draft" ? "flex" : "hidden"} relative z-[1] min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden overscroll-y-contain max-lg:min-h-0 max-lg:flex-1 max-lg:px-0 lg:min-h-0 lg:flex`}>
          {lyricDocPane === "draft" ?
            <DraftEditor
              value={fullText}
              onChange={setFullText}
              lineFeedbackByIndex={lineFeedbackByIndex}
              lineFeedbackAutoShowKey={lineFeedbackAutoShowKey}
              onMobileSave={isSong ? handleSaveVersion : undefined}
              mobileSavePending={savePending || newVersionPending}
              onDraftContextChange={setDraftContext}
              addToChatEnabled
              mobileTopRow={
                <div className="flex w-full min-w-0 items-center gap-2">
                  <Link
                    href={isSong ? "/" : "/lineroom"}
                    prefetch
                    aria-label={isSong ? "Back to dashboard" : "Back to LineRoom"}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/60 text-base leading-none text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80"
                  >
                    <span aria-hidden>←</span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    {isSong && props.mode === "song" ?
                      <SongTitleEditor
                        songId={props.songId}
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
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-2 text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/80"
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
              onAddSelectionToChat={(sel) => {
                setChatPinnedSelections((prev) => {
                  const key = `${sel.startLine}:${sel.endLine}:${sel.text}`;
                  if (
                    prev.some(
                      (p) => `${p.startLine}:${p.endLine}:${p.text}` === key,
                    )
                  ) {
                    return prev;
                  }
                  if (prev.length >= 16) return prev;
                  return [...prev, sel];
                });
                setMobilePane("chat");
              }}
              headerTrailing={
                <DraftRecordingsPanel
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
                  mobileFabVisible={
                    mobilePane === "draft" && lyricDocPane === "draft"
                  }
                  disabled={
                    savePending ||
                    deleteVersionPending ||
                    newVersionPending ||
                    critiqueLoading
                  }
                />
              }
            />
          : <DraftEditor
              value={brainstormText}
              onChange={setBrainstormText}
              lineFeedbackByIndex={EMPTY_LINE_FEEDBACK}
              lineFeedbackAutoShowKey=""
              showFeedbackToggle={false}
              copyButtonIdleLabel="Copy"
              placeholder="Ideas, word lists, alternate lines…"
              textInputAriaLabel="Brainstorm notes"
              mobileTopRow={
                <div className="flex w-full min-w-0 items-center gap-2">
                  <Link
                    href={isSong ? "/" : "/lineroom"}
                    prefetch
                    aria-label={isSong ? "Back to dashboard" : "Back to LineRoom"}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/60 text-base leading-none text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80"
                  >
                    <span aria-hidden>←</span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    {isSong && props.mode === "song" ?
                      <SongTitleEditor
                        songId={props.songId}
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
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-2 text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/80"
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
              onMobileSave={isSong ? handleSaveVersion : undefined}
              mobileSavePending={savePending || newVersionPending}
              bodyPrefix={
                <p className="px-3 pt-2.5 pb-1 text-xs leading-relaxed text-zinc-500">
                  Private scratch space for this version. Not sent to the lyric
                  assistant or critique.
                </p>
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
            onCritiqueMetaChange={setMeta}
            draftContext={draftContext}
            pinnedSelections={chatPinnedSelections}
            onClearPinnedSelections={() => setChatPinnedSelections([])}
            onRemovePinnedSelection={(index) =>
              setChatPinnedSelections((prev) =>
                prev.filter((_, i) => i !== index),
              )
            }
          />
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-[50] shrink-0 border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid w-full max-w-[1920px] grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMobilePane("critique")}
            className={mobilePane === "critique" ? "rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900" : "rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"}
          >
            Critique
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("draft")}
            className={mobilePane === "draft" ? "rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900" : "rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"}
          >
            Draft
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("chat")}
            className={mobilePane === "chat" ? "rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900" : "rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"}
          >
            Chat
          </button>
        </div>
      </div>
      <UpgradeModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}
