"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import posthog from "posthog-js";
import { createPortal } from "react-dom";
import {
  publishSongLyrics,
  unpublishSongLyrics,
} from "@/lib/songs/actions";
import { publishedLyricsUrl } from "@/lib/songs/publishedLyrics";

type PopoverAnchor = {
  top: number;
  right: number;
};

function formatPublishError(message: string): string {
  if (/share_token|published_/i.test(message)) {
    return "Sharing is not set up yet. Apply the latest database migration, then try again.";
  }
  return message;
}

export function ShareLyricsButton(props: {
  songId: string;
  activeVersionId: string;
  activeVersionNumber: number;
  draftText: string;
  shareToken: string | null;
  publishedFromVersionId: string | null;
  publishedFromVersionNumber: number | null;
  publishedDraftText: string | null;
  disabled?: boolean;
  buttonClassName?: string;
  fullWidth?: boolean;
}) {
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [shareToken, setShareToken] = useState(props.shareToken);
  const [publishedFromVersionId, setPublishedFromVersionId] = useState(
    props.publishedFromVersionId,
  );
  const [publishedFromVersionNumber, setPublishedFromVersionNumber] =
    useState(props.publishedFromVersionNumber);
  const [publishedDraftText, setPublishedDraftText] = useState(
    props.publishedDraftText,
  );
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setShareToken(props.shareToken);
    setPublishedFromVersionId(props.publishedFromVersionId);
    setPublishedFromVersionNumber(props.publishedFromVersionNumber);
    setPublishedDraftText(props.publishedDraftText);
  }, [
    props.shareToken,
    props.publishedFromVersionId,
    props.publishedFromVersionNumber,
    props.publishedDraftText,
  ]);

  const updateAnchor = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const shareUrl = shareToken ? publishedLyricsUrl(shareToken) : "";
  const isPublished = Boolean(shareToken);
  const needsUpdate =
    isPublished &&
    (props.activeVersionId !== publishedFromVersionId ||
      props.draftText !== publishedDraftText);

  const handlePublish = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await publishSongLyrics(
        props.songId,
        props.activeVersionId,
      );
      if (!result.ok) {
        setError(formatPublishError(result.message));
        return;
      }
      posthog.capture("lyrics_published", {
        publish_action: isPublished ? "update" : "create",
        version_number: props.activeVersionNumber,
      });
      setShareToken(result.shareToken);
      setPublishedFromVersionId(props.activeVersionId);
      setPublishedFromVersionNumber(props.activeVersionNumber);
      setPublishedDraftText(props.draftText);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopyLabel("Copied");
        window.setTimeout(() => setCopyLabel("Copy link"), 1500);
      } catch {
        // Link is visible even if clipboard fails.
      }
    });
  }, [
    props.activeVersionId,
    props.activeVersionNumber,
    props.draftText,
    props.songId,
    isPublished,
  ]);

  const handleUnpublish = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await unpublishSongLyrics(props.songId);
      if (!result.ok) {
        setError(formatPublishError(result.message));
        return;
      }
      posthog.capture("lyrics_unpublished");
      setShareToken(null);
      setPublishedFromVersionId(null);
      setPublishedFromVersionNumber(null);
      setPublishedDraftText(null);
      setOpen(false);
    });
  }, [props.songId]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy link"), 1500);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy link"), 1500);
    }
  }, [shareUrl]);

  const buttonClasses =
    props.buttonClassName ??
    "shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50";

  const panelContent = (
    <>
      {isPublished ?
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            {publishedFromVersionNumber != null ?
              `Snapshot of v${publishedFromVersionNumber}. Republish to update.`
            : "Published link."}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-200"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            >
              {copyLabel}
            </button>
          </div>
          {needsUpdate ?
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="w-full rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
            >
              {pending ? "Updating…" : "Update link"}
            </button>
          : null}
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={pending}
            className="w-full rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
          >
            {pending ? "Stopping…" : "Stop sharing"}
          </button>
        </div>
      : <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Create a public link with the draft lyrics from v
            {props.activeVersionNumber}. AI feedback stays private.
          </p>
          <button
            type="button"
            onClick={handlePublish}
            disabled={pending}
            className="w-full rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create link"}
          </button>
        </div>
      }

      {error ?
        <p className="mt-2 text-xs text-red-400">{error}</p>
      : null}
    </>
  );

  const overlay =
    open && mounted ?
      createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[125] cursor-default bg-black/40"
            aria-label="Close share dialog"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id={popoverId}
            role="dialog"
            aria-modal="true"
            aria-label="Share lyrics"
            className={
              props.fullWidth ?
                "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[130] rounded-xl border border-zinc-700/85 bg-zinc-950 p-4 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[min(calc(100vw-1.5rem),20rem)] sm:-translate-x-1/2"
              : "fixed z-[130] w-[min(calc(100vw-1.5rem),18rem)] rounded-xl border border-zinc-700/85 bg-zinc-950 p-4 shadow-2xl"
            }
            style={
              props.fullWidth || !anchor ?
                undefined
              : {
                  top: anchor.top,
                  right: anchor.right,
                }
            }
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Share lyrics</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
            {panelContent}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setError(null);
          setOpen((value) => !value);
        }}
        disabled={props.disabled || pending}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className={`${buttonClasses}${props.fullWidth ? " w-full" : ""}`}
      >
        Share
      </button>
      {overlay}
    </>
  );
}
