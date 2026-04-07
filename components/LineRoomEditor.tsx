"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { CritiqueSetupPanel } from "@/components/CritiqueSetupPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { LyricChatPanel } from "@/components/LyricChatPanel";
import { SongTitleEditor } from "@/components/songs/song-title-editor";
import {
  buildLineFeedbackByIndex,
  type LineAnnotation,
} from "@/lib/lineAnnotations";
import {
  saveNewSongVersion,
  updateSongVersionState,
} from "@/lib/songs/actions";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import { critiqueResultSchema } from "@/lib/validators";

const LS_DRAFT = "lineroom_draft";
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

function parseMeta(raw: string | null): CritiqueMeta {
  const empty: CritiqueMeta = { title: "", similarArtists: "", genre: "" };
  if (raw === null) return empty;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    return {
      title: typeof j.title === "string" ? j.title : "",
      similarArtists:
        typeof j.similarArtists === "string" ? j.similarArtists : "",
      genre: typeof j.genre === "string" ? j.genre : "",
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
  activeVersionId: string;
  initialDraftText: string;
  initialChatMessages: ChatMessage[];
  initialCritique: CritiqueResult | null;
  initialMeta: CritiqueMeta;
};

export type LineRoomEditorProps = LocalProps | SongProps;
type MobilePane = "draft" | "chat" | "critique";

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
              className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-100 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25"
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
            disabled={props.savePending}
            className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {props.savePending ? "Saving…" : "Save version"}
          </button>
        </div>
      </div>
      {props.saveError ?
        <p className="mx-auto mt-2 max-w-[1920px] text-xs text-red-400">
          {props.saveError}
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
  const [savePending, startSaveTransition] = useTransition();
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("draft");

  const songId = isSong ? props.songId : null;
  const songTitleFromProps = props.mode === "song" ? props.songTitle : null;
  const activeVersionId = props.mode === "song" ? props.activeVersionId : null;

  useEffect(() => {
    if (songTitleFromProps === null) return;
    setPieceTitle(songTitleFromProps);
  }, [songTitleFromProps]);

  useEffect(() => {
    setMeta((m) => ({ ...m, title: pieceTitle }));
  }, [pieceTitle]);

  useEffect(() => {
    if (props.mode === "song") return;
    try {
      const d = localStorage.getItem(LS_DRAFT);
      const c = localStorage.getItem(LS_CHAT);
      const cr = localStorage.getItem(LS_CRITIQUE);
      const m = localStorage.getItem(LS_META);
      if (d !== null) setFullText(d);
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

  const lineFeedbackByIndex = useMemo(
    () =>
      critique ?
        buildLineFeedbackByIndex(fullText, critique.lineFeedback)
      : new Map<number, LineAnnotation[]>(),
    [critique, fullText],
  );

  const lyricsEmpty = !fullText.trim();

  const autosavePayload = useMemo(
    () =>
      JSON.stringify({
        draft_text: fullText,
        chat_messages: chatMessages,
        critique,
        meta,
      }),
    [chatMessages, critique, fullText, meta],
  );

  const persistSongState = useCallback(
    async (nextCritique?: CritiqueResult | null) => {
      if (!isSong) return;
      const versionId = activeVersionId;
      if (!songId || !versionId) return;
      setAutosaveError(null);
      const result = await updateSongVersionState(songId, versionId, {
        draft_text: fullText,
        chat_messages: chatMessages,
        critique: nextCritique === undefined ? critique : nextCritique,
        meta,
      });
      if (!result.ok) {
        setAutosaveError(result.message);
      }
    },
    [activeVersionId, chatMessages, critique, fullText, isSong, meta, songId],
  );

  useEffect(() => {
    if (!isSong) return;

    const t = setTimeout(() => {
      void persistSongState();
    }, 1000);

    return () => clearTimeout(t);
  }, [autosavePayload, isSong, persistSongState]);

  const runCritique = useCallback(async () => {
    if (!fullText.trim()) return;
    setCritiqueError(null);
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
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        critique?: CritiqueResult;
      };
      if (!res.ok) {
        setCritiqueError(
          typeof data.error === "string" ? data.error : "Critique failed.",
        );
        return;
      }
      if (data.critique) {
        setCritique(data.critique);
        await persistSongState(data.critique);
      } else {
        setCritiqueError("Missing critique in response.");
      }
    } catch {
      setCritiqueError("Network error.");
    } finally {
      setCritiqueLoading(false);
    }
  }, [fullText, meta.genre, meta.similarArtists, persistSongState, pieceTitle]);

  const handleSaveVersion = useCallback(() => {
    if (!songId) return;
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await saveNewSongVersion(songId, {
        draft_text: fullText,
        chat_messages: chatMessages,
        critique,
        meta,
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      router.replace(`/song/${songId}?v=${result.versionId}`);
      router.refresh();
    });
  }, [chatMessages, critique, fullText, meta, router, songId]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950">
      <Header showDashboardLink={isSong} />
      {isSong ?
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
        />
      : null}
      {isSong && autosaveError ? (
        <div className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">
          Autosave failed: {autosaveError}
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[1920px] shrink-0 px-4 pt-3 lg:hidden">
        <div className="grid grid-cols-3 gap-2">
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
          <button
            type="button"
            onClick={() => setMobilePane("critique")}
            className={mobilePane === "critique" ? "rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900" : "rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"}
          >
            Critique
          </button>
        </div>
      </div>
      <main className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden gap-6 p-4 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_minmax(260px,380px)] lg:gap-5 lg:p-6 lg:pb-6">
        <section className={`${mobilePane === "draft" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col gap-2 lg:flex`}>
          <DraftEditor
            value={fullText}
            onChange={setFullText}
            lineFeedbackByIndex={lineFeedbackByIndex}
          />
        </section>

        <section className={`${mobilePane === "chat" ? "flex" : "hidden"} min-h-0 flex-col border-t border-zinc-800/80 pt-4 lg:flex lg:border-l lg:border-t-0 lg:border-zinc-800/80 lg:pl-5 lg:pt-0`}>
          {critique ?
            <LyricChatPanel
              fullText={fullText}
              pieceTitle={pieceTitle}
              messages={chatMessages}
              onMessagesChange={setChatMessages}
              critique={critique}
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
              onGenerate={() => void runCritique()}
              loading={critiqueLoading}
              error={critiqueError}
              lyricsEmpty={lyricsEmpty}
            />
          }
        </section>

        <section className={`${mobilePane === "critique" ? "flex" : "hidden"} min-h-0 flex-col border-t border-zinc-800/80 pt-4 lg:flex lg:border-l lg:border-t-0 lg:border-zinc-800/80 lg:pl-5 lg:pt-0`}>
          <CritiqueDisplayPanel
            critique={critique}
            loading={critiqueLoading}
            onRegenerate={() => void runCritique()}
            lyricsEmpty={lyricsEmpty}
          />
        </section>
      </main>
    </div>
  );
}
