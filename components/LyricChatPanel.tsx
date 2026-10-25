"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { StructuredAssistantMessage } from "@/components/chat/StructuredAssistantMessage";
import { useMobileToolbarInset } from "@/lib/hooks/useMobileToolbarInset";
import { buildChatActionPayload } from "@/lib/chat/buildChatActionPayload";
import type { ChatMessage, CritiqueMeta, CritiqueResult } from "@/lib/types";
import { chatActionResponseSchema } from "@/lib/validators";
import type { ChatAction } from "@/types/chat";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const WORKSHOP_MODES: {
  id: ChatAction;
  title: string;
  blurb: string;
  placeholder: string;
  /** Soft cap so users can’t paste whole drafts. */
  maxChars: number;
}[] = [
  {
    id: "find_rhymes",
    title: "Rhyme",
    blurb: "Words that rhyme with a target sound",
    placeholder: "Input your word here",
    maxChars: 48,
  },
  {
    id: "suggest_rewrites",
    title: "Suggestion",
    blurb: "Alternatives for one line",
    placeholder: "Input your line here",
    maxChars: 160,
  },
  {
    id: "diagnose",
    title: "Thesaurus",
    blurb: "Synonyms and near-synonyms",
    placeholder: "Input your word here",
    maxChars: 48,
  },
];

function modeMeta(action: ChatAction) {
  return WORKSHOP_MODES.find((m) => m.id === action)!;
}

function normalizeWorkshopInput(action: ChatAction, raw: string): string {
  const singleLine = raw.replace(/\r\n/g, "\n").split("\n")[0] ?? "";
  const trimmed = singleLine.trim();
  const { maxChars } = modeMeta(action);
  return trimmed.slice(0, maxChars);
}

function buildUserMessage(action: ChatAction, target: string): string {
  switch (action) {
    case "find_rhymes":
      return `Find words that rhyme with "${target}".`;
    case "diagnose":
      return `Give me other words that mean something similar to "${target}".`;
    case "suggest_rewrites":
      return `Suggest rewrites for this line, improving prosody while retaining meaning:\n${target}`;
  }
}

type Props = {
  fullText: string;
  pieceTitle: string;
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  onClearMessages: () => void;
  /** When null (before the first critique), workshop still works; structured critique context is omitted. */
  critique: CritiqueResult | null;
  critiqueMeta: CritiqueMeta;
  /** Guest try: Workshop is account-only — show signup CTA instead of tools. */
  lockedForGuests?: boolean;
};

export function LyricChatPanel({
  fullText,
  pieceTitle,
  messages,
  onMessagesChange,
  onClearMessages,
  critique,
  critiqueMeta,
  lockedForGuests = false,
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
  const [selectedMode, setSelectedMode] = useState<ChatAction | null>(null);

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
    const nextHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${Math.max(nextHeight, 44)}px`;
  }, [input, selectedMode]);

  useEffect(() => {
    if (!selectedMode) return;
    const el = composerInputRef.current;
    if (!el) return;
    el.focus();
  }, [selectedMode]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, mobileComposerInsetPx]);

  function selectMode(action: ChatAction) {
    setSelectedMode(action);
    setInput("");
    setError(null);
  }

  async function send() {
    if (!selectedMode || loading) return;
    const target = normalizeWorkshopInput(selectedMode, input);
    if (!target) return;

    setError(null);
    const userContent = buildUserMessage(selectedMode, target);
    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: userContent },
    ];
    onMessagesChange(nextHistory);
    setInput("");
    setLoading(true);

    const chatActionPayload = buildChatActionPayload({
      action: selectedMode,
      scope: "selection",
      draft: fullText,
      critique: critique ?? undefined,
      selections: [{ startLine: 0, endLine: 0, text: target }],
      userMessage: userContent,
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText,
          pieceTitle,
          messages: nextHistory,
          ...(critique ? { critique } : {}),
          critiqueMeta,
          chatAction: chatActionPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "Request failed.",
        );
        onMessagesChange(messages);
        return;
      }

      if (res.headers.get("X-Chat-Response-Kind") !== "action") {
        setError("Unexpected response from workshop.");
        onMessagesChange(messages);
        return;
      }

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
    } catch {
      setError("Network error.");
      onMessagesChange(messages);
    } finally {
      setLoading(false);
    }
  }

  if (lockedForGuests) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 max-lg:rounded-none max-lg:border-x-0">
        <div
          ref={mobileHeaderRef}
          className="shrink-0 border-b border-zinc-800/80 px-3 py-3 max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--lineroom-mobile-top,0px)] max-lg:z-[50] max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pt-[max(0.625rem,var(--lineroom-safe-top,env(safe-area-inset-top)))] max-lg:backdrop-blur-md lg:relative lg:z-auto lg:bg-transparent lg:px-3 lg:pt-2"
        >
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-300">
            Workshop your lyrics
          </h2>
        </div>
        <div
          className="shrink-0 lg:hidden"
          style={{ height: mobileHeaderInsetPx }}
          aria-hidden
        />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <div className="max-w-sm space-y-2">
            <p className="text-base font-medium text-zinc-100">
              Workshop is for signed-up users
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Create an account to use Rhyme, Suggestion, and Thesaurus on a word
              or line at a time.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const active = selectedMode ? modeMeta(selectedMode) : null;
  const canSend = Boolean(
    selectedMode &&
      normalizeWorkshopInput(selectedMode, input) &&
      !loading,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 max-lg:rounded-none max-lg:border-x-0">
      <div
        ref={mobileHeaderRef}
        className="shrink-0 border-b border-zinc-800/80 px-3 py-3 max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--lineroom-mobile-top,0px)] max-lg:z-[50] max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:pt-[max(0.625rem,var(--lineroom-safe-top,env(safe-area-inset-top)))] max-lg:backdrop-blur-md lg:relative lg:z-auto lg:bg-transparent lg:px-3 lg:pt-2"
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
              setSelectedMode(null);
              setInput("");
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
        {!selectedMode && messages.length === 0 && !loading ?
          <div className="flex min-h-full flex-col px-0.5 pt-2">
            <div className="flex flex-1 items-center">
              <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
                <p className="text-center text-xs text-zinc-300">
                  Choose a tool. One word or one line per request, not a full rewrite.
                </p>
                {WORKSHOP_MODES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={loading}
                    onClick={() => selectMode(a.id)}
                    className="rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-3 py-2.5 text-left transition hover:border-emerald-800/50 hover:bg-emerald-950/15 disabled:opacity-40"
                  >
                    <span className="block text-sm font-medium text-zinc-100">
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {a.blurb}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        : null}

        {(selectedMode || messages.length > 0) && messages.length === 0 && !loading ?
          <p className="px-0.5 pt-1 text-center text-xs text-zinc-500">
            Results show up here after you send.
          </p>
        : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user" ?
                "ml-6 rounded-lg border border-emerald-900/35 bg-emerald-950/20 px-3 py-2 text-sm text-zinc-100"
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
        {loading ?
          <div className="mr-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-500">
            Thinking…
          </div>
        : null}
        <div
          className="shrink-0 lg:hidden"
          style={{ height: mobileComposerInsetPx }}
          aria-hidden
        />
      </div>

      {selectedMode || messages.length > 0 ?
        <div
          ref={mobileComposerRef}
          className="shrink-0 border-t border-zinc-800/80 px-3 py-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-lg:z-[50] max-lg:border-zinc-800/80 max-lg:bg-zinc-950/95 max-lg:px-4 max-lg:py-2 max-lg:shadow-[0_-12px_32px_rgba(0,0,0,0.45)] max-lg:backdrop-blur-md lg:relative lg:bottom-auto lg:z-auto lg:bg-transparent lg:shadow-none"
        >
          <div className="mb-2 flex gap-1.5">
            {WORKSHOP_MODES.map((a) => {
              const on = selectedMode === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={loading}
                  onClick={() => selectMode(a.id)}
                  className={
                    on ?
                      "min-w-0 flex-1 rounded-md bg-emerald-800/90 px-2 py-1.5 text-[11px] font-semibold text-zinc-50"
                    : "min-w-0 flex-1 rounded-md border border-zinc-700/90 bg-zinc-900/70 px-2 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40"
                  }
                >
                  {a.title}
                </button>
              );
            })}
          </div>

          {error ?
            <div
              className="mb-2 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
              role="alert"
            >
              {error}
            </div>
          : null}

          {active ?
            <div className="flex gap-2">
              <textarea
                ref={composerInputRef}
                value={input}
                onChange={(e) =>
                  setInput(
                    e.target.value
                      .replace(/\r\n/g, "\n")
                      .split("\n")[0]
                      ?.slice(0, active.maxChars) ?? "",
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                disabled={loading}
                maxLength={active.maxChars}
                className="h-11 max-h-[7.5rem] flex-1 resize-none overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800/85 p-3 text-sm text-zinc-50 placeholder:text-zinc-400 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50"
                style={{ colorScheme: "dark" }}
                placeholder={active.placeholder}
                aria-label={active.placeholder}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                className="h-11 shrink-0 self-end rounded-lg bg-emerald-700/90 px-4 text-sm font-medium text-zinc-950 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          : (
            <p className="px-0.5 py-2 text-center text-[11px] text-zinc-500">
              Select Rhyme, Suggestion, or Thesaurus to continue.
            </p>
          )}
        </div>
      : null}
    </div>
  );
}
