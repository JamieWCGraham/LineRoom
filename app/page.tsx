"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CritiqueDisplayPanel } from "@/components/CritiqueDisplayPanel";
import { CritiqueSetupPanel } from "@/components/CritiqueSetupPanel";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { LyricChatPanel } from "@/components/LyricChatPanel";
import { buildLineFeedbackByIndex } from "@/lib/lineAnnotations";
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

export default function HomePage() {
  const [fullText, setFullText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [critique, setCritique] = useState<CritiqueResult | null>(null);
  const [meta, setMeta] = useState<CritiqueMeta>({
    title: "",
    similarArtists: "",
    genre: "",
  });
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_DRAFT, fullText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [fullText]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_CHAT, JSON.stringify(chatMessages));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [chatMessages]);

  useEffect(() => {
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
  }, [critique]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_META, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [meta]);

  const lineFeedbackByIndex = useMemo(
    () =>
      critique ?
        buildLineFeedbackByIndex(fullText, critique.lineFeedback)
      : new Map<number, string[]>(),
    [critique, fullText],
  );

  const lyricsEmpty = !fullText.trim();

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
          title: meta.title,
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
      } else {
        setCritiqueError("Missing critique in response.");
      }
    } catch {
      setCritiqueError("Network error.");
    } finally {
      setCritiqueLoading(false);
    }
  }, [fullText, meta.genre, meta.similarArtists, meta.title]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Header />
      <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 p-4 pb-10 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_minmax(260px,380px)] lg:gap-5 lg:p-6 lg:pb-8">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:min-h-[calc(100vh-5.5rem)]">
          <DraftEditor
            value={fullText}
            onChange={setFullText}
            lineFeedbackByIndex={lineFeedbackByIndex}
          />
        </section>

        <section className="flex min-h-[420px] flex-col border-t border-zinc-800/80 pt-6 lg:min-h-[calc(100vh-5.5rem)] lg:border-l lg:border-t-0 lg:border-zinc-800/80 lg:pl-5 lg:pt-0">
          {critique ?
            <LyricChatPanel
              fullText={fullText}
              messages={chatMessages}
              onMessagesChange={setChatMessages}
              critique={critique}
              critiqueMeta={meta}
              onCritiqueMetaChange={setMeta}
            />
          : <CritiqueSetupPanel
              title={meta.title}
              similarArtists={meta.similarArtists}
              genre={meta.genre}
              onTitleChange={(title) => setMeta((m) => ({ ...m, title }))}
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

        <section className="flex min-h-[360px] flex-col border-t border-zinc-800/80 pt-6 lg:min-h-[calc(100vh-5.5rem)] lg:border-l lg:border-t-0 lg:border-zinc-800/80 lg:pl-5 lg:pt-0">
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
