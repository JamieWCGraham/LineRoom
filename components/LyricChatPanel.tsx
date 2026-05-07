"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
    title: "Rhyme",
    example: "e.g. Words that rhyme with your ending sound (shown in a grid)",
  },
  {
    id: "suggest_rewrites",
    title: "Suggestions",
    example:
      "e.g. Suggest rewrites or alternatives to this line improving prosody while retaining meaning",
  },
  {
    id: "diagnose",
    title: "Thesaurus",
    example:
      "e.g. Give me other words that mean something similar to this word",
  },
];

type Props = {
  fullText: string;
  pieceTitle: string;
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  onClearMessages: () => void;
  /** When null (before the first critique), workshop still works; structured critique context is omitted. */
  critique: CritiqueResult | null;
  critiqueMeta: CritiqueMeta;
};

export function LyricChatPanel({
  fullText,
  pieceTitle,
  messages,
  onMessagesChange,
  onClearMessages,
  critique,
  critiqueMeta,
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
  const chatScope: ChatScope = "full_draft";

  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const mobileComposerRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const mobileHeaderInsetPx = useMobileToolbarInset(mobileHeaderRef);
  const mobileComposerInsetPx = useMobileToolbarInset(mobileComposerRef);

  useLayoutEffect(() => {
    const el = composerInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, 240);
    el.style.height = `${Math.max(nextHeight, 44)}px`;
  }, [input]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, mobileComposerInsetPx]);

  function applyActionPrefill(action: ChatAction) {
    setSelectedChatAction(action);
    const sectionType = getSectionForLine(fullText, 0).type;
    const rhymeTargetWord =
      action === "find_rhymes" ? extractRhymeAnchorWord(fullText) : undefined;
    setInput(
      prefillChatAction(action, chatScope, sectionType, {
        pins: [],
        rhymeTargetWord,
      }),
    );
  }

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
    setModeBanner(null);

    const chatActionPayload = selectedChatAction ?
      buildChatActionPayload({
        action: selectedChatAction,
        scope: chatScope,
        draft: fullText,
        critique: critique ?? undefined,
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
          ...(critique ? { critique } : {}),
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
        className="shrink-0 border-b border-zinc-800/80 px-3 py-3 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-[50] max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pt-[max(0.625rem,env(safe-area-inset-top))] max-lg:backdrop-blur-md lg:relative lg:z-auto lg:bg-transparent lg:px-3 lg:pt-2"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-300">
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
            }}
            disabled={loading || messages.length === 0}
            className="rounded-md border border-zinc-500/90 bg-zinc-800/85 px-2.5 py-1 text-[11px] font-semibold text-zinc-50 transition hover:border-zinc-300 hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            New Session
          </button>
        </div>
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
          <div className="flex min-h-full flex-col gap-3 px-0.5 pt-2">
            <p className="text-center text-xs text-zinc-300">
              Start with a quick action or type your own message below.
            </p>
            <div className="flex flex-1 items-center">
              <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
                {CHAT_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={loading}
                    onClick={() => applyActionPrefill(a.id)}
                    className="rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-3 py-2.5 text-left transition hover:border-emerald-800/50 hover:bg-emerald-950/15 disabled:opacity-40"
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
          </div>
        : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-lg border border-emerald-900/35 bg-emerald-950/20 px-3 py-2 text-sm text-zinc-100"
                : "mr-4 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm leading-relaxed text-zinc-300"
            }
          >
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {m.role === "user" ? "You" : "Assistant"}
            </span>
            {m.role === "assistant" && m.structured ?
              <StructuredAssistantMessage structured={m.structured} />
            : m.role === "assistant" ?
              <div className="prose prose-invert max-w-none break-words text-zinc-200 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-zinc-100 prose-p:my-4 prose-p:leading-8 prose-li:my-1.5 prose-ul:my-4 prose-ol:my-4 prose-a:text-emerald-300 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-zinc-700 prose-blockquote:text-zinc-400 prose-pre:my-4 prose-pre:rounded-md prose-pre:bg-zinc-900 prose-code:text-zinc-200 prose-strong:text-zinc-100 [&_br]:block [&_br]:content-[''] [&_br]:mt-4">
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
        className="shrink-0 border-t border-zinc-800/80 px-3 pb-1.5 pt-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-lg:z-[50] max-lg:border-zinc-800/80 max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pb-1.5 max-lg:pt-2 max-lg:shadow-[0_-12px_32px_rgba(0,0,0,0.45)] max-lg:backdrop-blur-md lg:relative lg:bottom-auto lg:z-auto lg:bg-transparent lg:shadow-none"
      >
        {error ? (
          <div
            className="mb-2 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <div className="flex gap-2">
          <textarea
            ref={composerInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            disabled={loading}
            className="h-11 max-h-60 flex-1 resize-none overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800/85 p-3 text-sm text-zinc-50 placeholder:text-zinc-400 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50"
            style={{ colorScheme: "dark" }}
            placeholder="Message…"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="shrink-0 self-end rounded-lg bg-emerald-700/90 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
