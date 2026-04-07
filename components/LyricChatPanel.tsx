"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";

type Props = {
  fullText: string;
  pieceTitle: string;
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  critique: CritiqueResult;
  critiqueMeta: CritiqueMeta;
  onCritiqueMetaChange: (next: CritiqueMeta) => void;
};

export function LyricChatPanel({
  fullText,
  pieceTitle,
  messages,
  onMessagesChange,
  critique,
  critiqueMeta,
  onCritiqueMetaChange,
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setError(null);
    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    onMessagesChange(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText,
          pieceTitle,
          messages: nextHistory,
          critique,
          critiqueMeta,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Message failed.",
        );
        onMessagesChange(messages);
        return;
      }
      const reply =
        typeof data.message === "string" ? data.message : "";
      if (!reply) {
        setError("Empty reply.");
        onMessagesChange(messages);
        return;
      }
      onMessagesChange([
        ...nextHistory,
        { role: "assistant", content: reply },
      ]);
    } catch {
      setError("Network error.");
      onMessagesChange(messages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="shrink-0 border-b border-zinc-800/80 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Chat about your lyrics/poetry
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
          Ask follow-ups; replies use your latest draft and saved critique.
        </p>
        <details className="mt-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-500">
            Piece context (for regenerate)
          </summary>
          <div className="mt-2 space-y-2 pb-1">
            <p className="text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-400">Title:</span>{" "}
              {pieceTitle.trim() || "Untitled piece"}
            </p>
            <input
              type="text"
              value={critiqueMeta.genre}
              onChange={(e) =>
                onCritiqueMetaChange({
                  ...critiqueMeta,
                  genre: e.target.value,
                })
              }
              disabled={loading}
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
              placeholder="Genre"
            />
            <textarea
              value={critiqueMeta.similarArtists}
              onChange={(e) =>
                onCritiqueMetaChange({
                  ...critiqueMeta,
                  similarArtists: e.target.value,
                })
              }
              disabled={loading}
              rows={2}
              className="w-full resize-y rounded border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
              placeholder="Similar writers / voice (lyrics or poetry)"
            />
          </div>
        </details>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !loading ? (
          <p className="text-center text-sm text-zinc-600">
            Ask about imagery, structure, what&apos;s landing—or where
            you&apos;re stuck.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-lg border border-amber-900/35 bg-amber-950/20 px-3 py-2 text-sm text-zinc-100"
                : "mr-4 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm leading-relaxed text-zinc-300"
            }
          >
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {m.role === "user" ? "You" : "Assistant"}
            </span>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {loading ? (
          <div className="mr-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-500">
            Thinking…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div
          className="mx-3 mb-2 shrink-0 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="shrink-0 border-t border-zinc-800/80 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            disabled={loading}
            className="min-h-[44px] max-h-40 flex-1 resize-none overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
            placeholder="Message…"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="shrink-0 self-end rounded-lg bg-amber-700/90 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
