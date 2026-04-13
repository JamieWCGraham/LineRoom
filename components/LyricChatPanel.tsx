"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { StructuredAssistantMessage } from "@/components/chat/StructuredAssistantMessage";
import { useMobileToolbarInset } from "@/hooks/useMobileToolbarInset";
import { buildChatActionPayload } from "@/lib/chat/buildChatActionPayload";
import { getSectionForLine } from "@/lib/chat/sectionFromDraft";
import {
  extractRhymeAnchorWord,
  prefillChatAction,
} from "@/lib/chat/prefillChatAction";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import { chatActionResponseSchema } from "@/lib/validators";
import type {
  ChatAction,
  ChatScope,
  ChatSelectionPayload,
  DraftEditorContext,
} from "@/types/chat";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const CHAT_ACTIONS: {
  id: ChatAction;
  title: string;
  example: string;
}[] = [
  {
    id: "find_rhymes",
    title: "Find rhymes",
    example: "e.g. Find words that rhyme with “flat”",
  },
  {
    id: "suggest_rewrites",
    title: "Suggest rewrites",
    example:
      "e.g. Suggest rewrites or alternatives to this line improving prosody while retaining meaning",
  },
  {
    id: "diagnose",
    title: "Diagnose",
    example:
      "e.g. Is this selection landing? Let me know if it could be better.",
  },
];

type Props = {
  fullText: string;
  pieceTitle: string;
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  onClearMessages: () => void;
  critique: CritiqueResult;
  critiqueMeta: CritiqueMeta;
  onCritiqueMetaChange: (next: CritiqueMeta) => void;
  draftContext: DraftEditorContext;
  pinnedSelections: ChatSelectionPayload[];
  onClearPinnedSelections: () => void;
  onRemovePinnedSelection: (index: number) => void;
};

export function LyricChatPanel({
  fullText,
  pieceTitle,
  messages,
  onMessagesChange,
  onClearMessages,
  critique,
  critiqueMeta,
  onCritiqueMetaChange,
  draftContext,
  pinnedSelections,
  onClearPinnedSelections,
  onRemovePinnedSelection,
}: Props) {
  const formatAssistantContent = (content: string): string => {
    const normalized = content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const segments = normalized.split(/(```[\s\S]*?```)/g);

    const spaced = segments.map((segment) => {
      if (segment.startsWith("```")) return segment;

      return segment
        .split("\n")
        .map((line) => {
          if (
            /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|)/.test(line) ||
            !line.trim()
          ) {
            return line;
          }
          return line.replace(
            /([.!?]["'”’]?)\s+(?=(?:["'“‘(\[])?[A-Z0-9])/g,
            "$1\n\n",
          );
        })
        .join("\n");
    });

    return spaced.join("");
  };

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modeBanner, setModeBanner] = useState<string | null>(null);
  const [selectedChatAction, setSelectedChatAction] = useState<ChatAction | null>(
    null,
  );
  const [quickActionSelect, setQuickActionSelect] = useState("");
  /** When nothing is pinned from the draft, choose section vs full draft. */
  const [baseScope, setBaseScope] = useState<"section" | "full_draft">(
    "section",
  );

  const trimmedPins = pinnedSelections.filter((p) => p.text?.trim());
  const hasPinned = trimmedPins.length > 0;
  const chatScope: ChatScope =
    hasPinned ? "selection"
    : baseScope === "full_draft" ? "full_draft"
    : "section";

  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const mobileComposerRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const mobileHeaderInsetPx = useMobileToolbarInset(mobileHeaderRef);
  const mobileComposerInsetPx = useMobileToolbarInset(mobileComposerRef);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, mobileComposerInsetPx]);

  useEffect(() => {
    if (messages.length === 0) setQuickActionSelect("");
  }, [messages.length]);

  function lineForSectionTypeHint(scope: ChatScope): number {
    if (scope === "selection" && trimmedPins[0] != null) {
      return trimmedPins[0].startLine;
    }
    return draftContext.caretLine;
  }

  function applyActionPrefill(action: ChatAction) {
    setSelectedChatAction(action);
    const scope = chatScope;
    const sectionType = getSectionForLine(
      fullText,
      lineForSectionTypeHint(scope),
    ).type;
    let rhymeTargetWord: string | undefined;
    if (action === "find_rhymes" && trimmedPins.length === 0) {
      if (scope === "section") {
        rhymeTargetWord = extractRhymeAnchorWord(
          getSectionForLine(fullText, draftContext.caretLine).text,
        );
      } else if (scope === "full_draft") {
        rhymeTargetWord = extractRhymeAnchorWord(fullText);
      }
    }
    setInput(
      prefillChatAction(action, scope, sectionType, {
        multipleSelections: trimmedPins.length > 1,
        pins: trimmedPins,
        rhymeTargetWord,
      }),
    );
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (selectedChatAction && chatScope === "selection" && !hasPinned) {
      setError("Highlight lyrics in the draft and choose Add to chat.");
      return;
    }

    setError(null);
    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    onMessagesChange(nextHistory);
    setInput("");
    setLoading(true);
    setModeBanner(null);

    const sectionBlock =
      chatScope === "section" ?
        getSectionForLine(fullText, draftContext.caretLine)
      : null;

    const chatActionPayload = selectedChatAction ?
      buildChatActionPayload({
        action: selectedChatAction,
        scope: chatScope,
        draft: fullText,
        critique,
        selections: hasPinned ? trimmedPins : null,
        section: sectionBlock,
        userMessage: trimmed,
      })
    : undefined;

    const useAction = Boolean(chatActionPayload);

    try {
      if (!useAction) {
        onMessagesChange([
          ...nextHistory,
          { role: "assistant", content: "" },
        ]);
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText,
          pieceTitle,
          messages: nextHistory,
          critique,
          critiqueMeta,
          ...(chatActionPayload ? { chatAction: chatActionPayload } : {}),
        }),
      });

      const mode = res.headers.get("X-Chat-Mode");
      const reasonTrace = res.headers.get("X-Reasoning-Trace");
      if (mode === "deep") {
        setModeBanner(
          reasonTrace ?
            `Deep reasoning mode: ${reasonTrace}`
          : "Deep reasoning mode enabled for this message.",
        );
      } else if (mode === "fast") {
        setModeBanner("Fast mode: low-latency concise response.");
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "Message failed.",
        );
        onMessagesChange(messages);
        return;
      }

      if (useAction && res.headers.get("X-Chat-Response-Kind") === "action") {
        const raw: unknown = await res.json();
        const parsed = chatActionResponseSchema.safeParse(raw);
        if (!parsed.success) {
          setError("Assistant returned an unexpected format.");
          onMessagesChange(messages);
          return;
        }
        const structured = parsed.data;
        onMessagesChange([
          ...nextHistory,
          {
            role: "assistant",
            content: structured.summary,
            structured,
          },
        ]);
        setSelectedChatAction(null);
        return;
      }

      if (!res.body) {
        setError("Missing response stream.");
        onMessagesChange(messages);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        onMessagesChange([
          ...nextHistory,
          { role: "assistant", content: reply },
        ]);
      }
      reply += decoder.decode();
      if (!reply.trim()) {
        setError("Empty reply.");
        onMessagesChange(messages);
      }
    } catch {
      setError("Network error.");
      onMessagesChange(messages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 max-lg:rounded-none max-lg:border-x-0">
      <div
        ref={mobileHeaderRef}
        className="shrink-0 border-b border-zinc-800/80 px-3 py-3 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-[50] max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pt-[max(0.25rem,env(safe-area-inset-top))] max-lg:backdrop-blur-md lg:relative lg:z-auto lg:bg-transparent lg:px-3 lg:pt-0"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Workshop your lyrics
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!messages.length || loading) return;
              onClearMessages();
              setError(null);
              setModeBanner(null);
              setSelectedChatAction(null);
              setBaseScope("section");
              onClearPinnedSelections();
            }}
            disabled={loading || messages.length === 0}
            className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            New Session
          </button>
        </div>
        <p className="mt-3 py-0.5 text-[11px] leading-relaxed text-zinc-600">
          Highlight lines and use <span className="text-zinc-500">Add to chat</span> to attach
          excerpts. Choose a quick action when starting or from Piece context after you chat.
        </p>
        <details className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5">
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
              style={{ colorScheme: "dark" }}
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
              style={{ colorScheme: "dark" }}
              placeholder="Similar writers / voice (lyrics or poetry)"
            />
            {messages.length > 0 ?
              <label className="block border-t border-zinc-800/80 pt-2">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500">
                  Quick actions
                </span>
                <select
                  value={quickActionSelect}
                  disabled={loading}
                  onChange={(e) => {
                    const v = e.target.value as ChatAction | "";
                    setQuickActionSelect(v);
                    if (v) {
                      applyActionPrefill(v);
                      queueMicrotask(() => setQuickActionSelect(""));
                    }
                  }}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Choose an action…</option>
                  {CHAT_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                  Prefills the message box; edit, then send.
                </p>
              </label>
            : null}
          </div>
        </details>
      </div>

      <div
        className="shrink-0 lg:hidden"
        style={{ height: mobileHeaderInsetPx }}
        aria-hidden
      />

      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-none px-3 pt-3 [touch-action:pan-y] lg:pb-3 max-lg:pb-0"
      >
        {modeBanner ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 text-[11px] text-zinc-400">
            {modeBanner}
          </div>
        ) : null}
        {messages.length === 0 && !loading ?
          <div className="flex min-h-[min(52vh,22rem)] flex-col justify-center gap-3 px-0.5 py-4">
            <p className="text-center text-xs text-zinc-500">
              Start with a quick action or type your own message below.
            </p>
            <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
              {CHAT_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={loading}
                  onClick={() => applyActionPrefill(a.id)}
                  className="rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-3 py-2.5 text-left transition hover:border-amber-800/50 hover:bg-amber-950/15 disabled:opacity-40"
                >
                  <span className="block text-sm font-medium text-zinc-100">
                    {a.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                    {a.example}
                  </span>
                </button>
              ))}
            </div>
          </div>
        : null}
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
            {m.role === "assistant" && m.structured ?
              <StructuredAssistantMessage structured={m.structured} />
            : m.role === "assistant" ?
              <div className="prose prose-invert max-w-none break-words text-zinc-200 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-zinc-100 prose-p:my-4 prose-p:leading-8 prose-li:my-1.5 prose-ul:my-4 prose-ol:my-4 prose-a:text-amber-300 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-zinc-700 prose-blockquote:text-zinc-400 prose-pre:my-4 prose-pre:rounded-md prose-pre:bg-zinc-900 prose-code:text-zinc-200 prose-strong:text-zinc-100 [&_br]:block [&_br]:content-[''] [&_br]:mt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {formatAssistantContent(m.content)}
                </ReactMarkdown>
              </div>
            : <p className="whitespace-pre-wrap">{m.content}</p>}
          </div>
        ))}
        {loading ? (
          <div className="mr-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-500">
            Thinking…
          </div>
        ) : null}
        <div
          className="shrink-0 lg:hidden"
          style={{ height: mobileComposerInsetPx }}
          aria-hidden
        />
      </div>

      <div
        ref={mobileComposerRef}
        className="shrink-0 border-t border-zinc-800/80 p-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-lg:z-[50] max-lg:border-zinc-800/80 max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pb-3 max-lg:pt-2 max-lg:shadow-[0_-12px_32px_rgba(0,0,0,0.45)] max-lg:backdrop-blur-md lg:relative lg:bottom-auto lg:z-auto lg:bg-transparent lg:shadow-none"
      >
        {error ? (
          <div
            className="mb-2 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <div className="mb-2 space-y-2">
          {hasPinned ?
            <div className="space-y-1.5 rounded-md border border-amber-900/40 bg-amber-950/25 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
                  In chat ({trimmedPins.length})
                </span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onClearPinnedSelections()}
                  className="shrink-0 rounded border border-zinc-600/80 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40"
                >
                  Clear all
                </button>
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {pinnedSelections.map((p, i) => {
                  if (!p.text?.trim()) return null;
                  const preview =
                    p.text.length > 40 ? `${p.text.slice(0, 40)}…` : p.text.trim();
                  return (
                    <li
                      key={`${i}-${p.startLine}-${p.endLine}`}
                      className="flex items-start gap-1.5 rounded border border-amber-900/25 bg-zinc-950/40 px-1.5 py-1"
                    >
                      <span className="min-w-0 flex-1 text-[10px] leading-snug text-amber-100/90">
                        <span className="font-medium text-amber-200/90">
                          {p.startLine + 1}–{p.endLine + 1}
                        </span>
                        {preview ? ` · ${preview}` : null}
                      </span>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onRemovePinnedSelection(i)}
                        className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200 disabled:opacity-40"
                        aria-label={`Remove excerpt ${i + 1}`}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          : <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Target
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => setBaseScope("section")}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                  baseScope === "section" ?
                    "border-amber-600/50 bg-amber-950/30 text-amber-100"
                  : "border-zinc-700/80 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                Current section
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setBaseScope("full_draft")}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                  baseScope === "full_draft" ?
                    "border-amber-600/50 bg-amber-950/30 text-amber-100"
                  : "border-zinc-700/80 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                Full draft
              </button>
            </div>
          }
        </div>
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
            rows={5}
            disabled={loading}
            className="min-h-[7.5rem] max-h-64 flex-1 resize-y overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-600/25 disabled:opacity-50"
            style={{ colorScheme: "dark" }}
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
