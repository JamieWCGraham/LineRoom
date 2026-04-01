"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionPanel } from "@/components/ActionPanel";
import { CritiquePanel } from "@/components/CritiquePanel";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { SuggestionCard } from "@/components/SuggestionCard";
import {
  getSurroundingContext,
  insertBelowFirstOccurrence,
  replaceFirstOccurrence,
} from "@/lib/text";
import type { CritiqueResponse, RewriteAction, RewriteOption } from "@/lib/types";
import { REWRITE_ACTIONS } from "@/lib/types";

const LS_DRAFT = "lineroom_draft";
const LS_VOICE = "lineroom_voice_notes";
const LS_SELECTED = "lineroom_selected";

export default function HomePage() {
  const [fullText, setFullText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [voiceNotes, setVoiceNotes] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [action, setAction] = useState<RewriteAction>(REWRITE_ACTIONS[0]);
  const [rewriteResults, setRewriteResults] = useState<RewriteOption[] | null>(
    null,
  );
  const [critiqueResult, setCritiqueResult] =
    useState<CritiqueResponse | null>(null);
  const [loading, setLoading] = useState<"idle" | "rewrite" | "critique">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [replaceWarning, setReplaceWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_DRAFT);
      const v = localStorage.getItem(LS_VOICE);
      const s = localStorage.getItem(LS_SELECTED);
      if (d !== null) setFullText(d);
      if (v !== null) setVoiceNotes(v);
      if (s !== null) setSelectedText(s);
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
        localStorage.setItem(LS_VOICE, voiceNotes);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [voiceNotes]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_SELECTED, selectedText);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [selectedText]);

  const runRewrite = useCallback(async () => {
    setError(null);
    setReplaceWarning(null);
    if (!selectedText.trim()) {
      setError("Add selected text to run a rewrite.");
      return;
    }
    setLoading("rewrite");
    try {
      const ctx = getSurroundingContext(fullText, selectedText);
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText,
          selectedText,
          action,
          customInstruction: customInstruction.trim() || undefined,
          voiceNotes: voiceNotes.trim() || undefined,
          contextBefore: ctx.contextBefore,
          contextAfter: ctx.contextAfter,
        }),
      });
      const data: { error?: string; options?: RewriteOption[] } =
        await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Rewrite failed.",
        );
        setRewriteResults(null);
        return;
      }
      setRewriteResults(data.options ?? null);
    } catch {
      setError("Network error while rewriting.");
      setRewriteResults(null);
    } finally {
      setLoading("idle");
    }
  }, [fullText, selectedText, action, customInstruction, voiceNotes]);

  const runCritique = useCallback(async () => {
    setError(null);
    if (!selectedText.trim()) {
      setError("Add selected text to run a critique.");
      return;
    }
    setLoading("critique");
    try {
      const ctx = getSurroundingContext(fullText, selectedText);
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText,
          selectedText,
          voiceNotes: voiceNotes.trim() || undefined,
          contextBefore: ctx.contextBefore,
          contextAfter: ctx.contextAfter,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Critique failed.",
        );
        return;
      }
      setCritiqueResult(data as CritiqueResponse);
    } catch {
      setError("Network error while critiquing.");
    } finally {
      setLoading("idle");
    }
  }, [fullText, selectedText, voiceNotes]);

  const handleReplace = useCallback(
    (text: string) => {
      setReplaceWarning(null);
      const { ok, result } = replaceFirstOccurrence(
        fullText,
        selectedText,
        text,
      );
      if (!ok) {
        setReplaceWarning(
          "Selected text was not found exactly in the draft. Copy the suggestion or align the selection with the draft.",
        );
        return;
      }
      setFullText(result);
    },
    [fullText, selectedText],
  );

  const handleInsertBelow = useCallback(
    (text: string) => {
      setReplaceWarning(null);
      const { ok, result } = insertBelowFirstOccurrence(
        fullText,
        selectedText,
        text,
      );
      if (!ok) {
        setReplaceWarning(
          "Selected text was not found exactly in the draft. Copy the suggestion or align the selection with the draft.",
        );
        return;
      }
      setFullText(result);
    },
    [fullText, selectedText],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }, []);

  const busyRewrite = loading === "rewrite";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Header />
      <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 p-4 pb-10 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)_minmax(300px,460px)] lg:gap-0 lg:p-6 lg:pb-8">
        <section className="flex min-h-0 min-w-0 flex-col gap-2 lg:border-r lg:border-zinc-800/80 lg:pr-6">
          <DraftEditor value={fullText} onChange={setFullText} />
        </section>

        <section className="flex min-h-0 flex-col border-t border-zinc-800/80 pt-6 lg:border-t-0 lg:px-5 lg:pt-0">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 lg:hidden">
            Actions
          </h2>
          <ActionPanel
            selectedText={selectedText}
            onSelectedChange={setSelectedText}
            action={action}
            onActionChange={setAction}
            customInstruction={customInstruction}
            onCustomInstructionChange={setCustomInstruction}
            voiceNotes={voiceNotes}
            onVoiceNotesChange={setVoiceNotes}
            onGenerate={runRewrite}
            onCritique={runCritique}
            loading={loading}
            disabledGenerate={!selectedText.trim()}
            disabledCritique={!selectedText.trim()}
          />
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-5 border-t border-zinc-800/80 pt-6 lg:border-t-0 lg:border-l lg:border-zinc-800/80 lg:pl-6 lg:pt-0">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Suggestions & critique
          </h2>

          {error ? (
            <div
              className="rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {replaceWarning ? (
            <div
              className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90"
              role="status"
            >
              {replaceWarning}
            </div>
          ) : null}

          {rewriteResults && rewriteResults.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Original selection
                </h3>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 font-sans text-[13px] leading-relaxed text-zinc-400">
                  {selectedText}
                </pre>
              </div>
              <div className="space-y-4">
                {rewriteResults.map((opt, i) => (
                  <SuggestionCard
                    key={`${opt.label}-${i}`}
                    option={opt}
                    index={i}
                    onReplace={handleReplace}
                    onInsertBelow={handleInsertBelow}
                    onCopy={handleCopy}
                    onRegenerate={runRewrite}
                    busy={busyRewrite}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">
              {busyRewrite
                ? "Generating options…"
                : "Generate rewrites to compare options beside your original selection."}
            </p>
          )}

          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              Critique
            </h3>
            <CritiquePanel result={critiqueResult} />
          </div>
        </section>
      </main>
    </div>
  );
}
