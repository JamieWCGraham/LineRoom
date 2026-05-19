"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { DraftRecordingMeta } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  idbDeleteRecording,
  idbGetRecording,
  idbPutRecording,
} from "@/lib/draft-recordings/idb";
import {
  fileExtFromMime,
  formatMmSs,
  instantiateMediaRecorder,
  pickRecorderMime,
  sanitizeDownloadFilenameBase,
} from "@/lib/draft-recordings/recordingFormat";
import { DRAFT_RECORDING_MAX_BYTES } from "@/lib/draft-recordings/uploadLimits";

const MAX_RECORDINGS = 40;

export type DraftRecordingsPanelHandle = {
  openVoicePanel: () => void;
};

export type DraftRecordingsPanelProps = {
  storageMode: "local" | "cloud";
  songId?: string;
  versionId?: string;
  recordings: DraftRecordingMeta[];
  onRecordingsChange: (next: DraftRecordingMeta[]) => void;
  disabled?: boolean;
  /** On narrow screens, hide the inline mic button and show a floating mic instead. */
  useMobileVoiceFab?: boolean;
  /** When using the FAB, whether it is shown (e.g. only while the draft tab is active). */
  mobileFabVisible?: boolean;
  /** When true with useMobileVoiceFab, the floating mic is omitted (e.g. tab bar opens the panel). */
  suppressMobileFloatingFab?: boolean;
};

export const DraftRecordingsPanel = forwardRef<
  DraftRecordingsPanelHandle,
  DraftRecordingsPanelProps
>(function DraftRecordingsPanel(
  {
    storageMode,
    songId,
    versionId,
    recordings,
    onRecordingsChange,
    disabled = false,
    useMobileVoiceFab = false,
    mobileFabVisible = true,
    suppressMobileFloatingFab = false,
  },
  ref,
) {
  const [panelOpen, setPanelOpen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      openVoicePanel: () => setPanelOpen(true),
    }),
    [],
  );
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [wide, setWide] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [micError, setMicError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingMime, setPendingMime] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Recording whose audio is loaded in the persistent `<audio>` element. */
  const [loadedMemoId, setLoadedMemoId] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playbackTimeSec, setPlaybackTimeSec] = useState(0);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  /** During pointer scrub, UI position; audio seeks only on release. */
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);
  const pendingScrubSecRef = useRef<number | null>(null);
  /** If true, resume playback once after pointer scrub ends. */
  const wasPlayingBeforePointerScrubRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DraftRecordingMeta | null>(
    null,
  );
  const [deletePending, setDeletePending] = useState(false);
  const [deleteActionError, setDeleteActionError] = useState<string | null>(
    null,
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const recordedDurationSecRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);
  const signCacheRef = useRef<Map<string, { url: string; exp: number }>>(
    new Map(),
  );

  const sorted = useMemo(
    () =>
      [...recordings].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [recordings],
  );

  const revokeLastAudioUrl = useCallback(() => {
    const u = lastObjectUrlRef.current;
    if (u?.startsWith("blob:")) {
      URL.revokeObjectURL(u);
    }
    lastObjectUrlRef.current = null;
  }, []);

  const fetchSignedUrl = useCallback(async (objectPath: string) => {
    const now = Date.now() / 1000;
    const hit = signCacheRef.current.get(objectPath);
    if (hit && hit.exp > now + 90) return hit.url;

    const res = await fetch(
      `/api/draft-recordings/sign?path=${encodeURIComponent(objectPath)}`,
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      url?: string;
      expiresIn?: number;
    };
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Sign failed");
    }
    if (!data.url) throw new Error("No playback URL");
    const ttl = typeof data.expiresIn === "number" ? data.expiresIn : 3500;
    signCacheRef.current.set(objectPath, { url: data.url, exp: now + ttl });
    return data.url;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const applyWide = () => setWide(mq.matches);
    applyWide();
    mq.addEventListener("change", applyWide);
    return () => mq.removeEventListener("change", applyWide);
  }, [panelOpen]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const el = triggerRef.current;
    if (!el) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setAnchor({
        top: r.bottom + 8,
        right: Math.max(12, window.innerWidth - r.right),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen || storageMode !== "cloud") return;
    const paths = recordings
      .map((r) => r.objectPath)
      .filter((p) => p.length > 0)
      .slice(0, 8);
    let cancelled = false;
    void (async () => {
      for (const p of paths) {
        if (cancelled) break;
        try {
          await fetchSignedUrl(p);
        } catch {
          /* prefetch best-effort */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, storageMode, recordings, fetchSignedUrl]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteConfirm) setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, deleteConfirm]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteConfirm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteConfirm]);

  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setAudioPlaying(true);
    const onPause = () => setAudioPlaying(false);
    const onEnded = () => {
      setLoadedMemoId(null);
      setAudioPlaying(false);
      setPlaybackTimeSec(0);
      setPlaybackDurationSec(0);
    };
    const onError = () => {
      setLoadedMemoId(null);
      setAudioPlaying(false);
      setPlaybackTimeSec(0);
      setPlaybackDurationSec(0);
    };
    const onTimeUpdate = () => {
      if (scrubbingRef.current) return;
      setPlaybackTimeSec(a.currentTime);
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setPlaybackDurationSec(a.duration);
      }
    };
    const onLoadedMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setPlaybackDurationSec(a.duration);
      }
      setPlaybackTimeSec(a.currentTime);
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("loadedmetadata", onLoadedMeta);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("loadedmetadata", onLoadedMeta);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioPlaying || scrubbing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = () => {
      if (scrubbingRef.current) return;
      setPlaybackTimeSec(a.currentTime);
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setPlaybackDurationSec(a.duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [audioPlaying, scrubbing]);

  useEffect(() => {
    return () => {
      revokeLastAudioUrl();
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [revokeLastAudioUrl]);

  const stopTicks = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startRecording = async () => {
    setMicError(null);
    setSaveError(null);
    if (recordings.length >= MAX_RECORDINGS) {
      setMicError(`You can store up to ${MAX_RECORDINGS} notes per version.`);
      return;
    }
    if (storageMode === "cloud" && (!songId || !versionId)) {
      setMicError("Save your piece to use cloud notes.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          // Softer processing preserves melody and scratch vocals vs. phone-call narrowband.
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48_000 },
        },
      });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const rec = instantiateMediaRecorder(stream, mime);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = () => setMicError("Recording failed.");
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recordedDurationSecRef.current =
          (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || mime || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) {
          setPendingBlob(blob);
          setPendingMime(rec.mimeType || mime || "audio/webm");
          const stamp = new Date();
          setPendingName(
            `Memo ${stamp.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${formatMmSs(
              recordedDurationSecRef.current,
            )}`,
          );
        }
        setRecording(false);
        stopTicks();
        setElapsedSec(0);
      };
      mediaRecorderRef.current = rec;
      startedAtRef.current = Date.now();
      /* ~500 ms slices: fewer chunks on long memos, still frequent enough for crash resilience. */
      rec.start(500);
      setRecording(true);
      setElapsedSec(0);
      stopTicks();
      tickRef.current = setInterval(() => {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }, 250);
    } catch {
      setMicError("Microphone permission is required to record.");
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      if (rec.state === "recording" && typeof rec.requestData === "function") {
        try {
          rec.requestData();
        } catch {
          /* ignore */
        }
      }
      rec.stop();
    }
    mediaRecorderRef.current = null;
  };

  const discardPending = () => {
    setPendingBlob(null);
    setPendingMime("");
    setPendingName("");
    setSaveError(null);
  };

  const commitPending = async () => {
    if (!pendingBlob) return;
    const name = pendingName.trim().slice(0, 120) || "Untitled memo";
    const id = crypto.randomUUID();
    const durationSec = Math.round(recordedDurationSecRef.current);

    setSaveError(null);
    setUploading(true);
    try {
      if (storageMode === "local") {
        const createdAt = new Date().toISOString();
        await idbPutRecording(id, pendingBlob);
        const next: DraftRecordingMeta = {
          id,
          name,
          objectPath: "",
          mimeType: pendingMime || pendingBlob.type || "audio/webm",
          createdAt,
          durationSec: Math.max(0, durationSec),
        };
        onRecordingsChange([next, ...recordings]);
        discardPending();
        return;
      }

      if (!songId || !versionId) {
        setSaveError("Missing piece or version.");
        return;
      }

      const mime = pendingMime || pendingBlob.type || "audio/webm";
      if (pendingBlob.size > DRAFT_RECORDING_MAX_BYTES) {
        setSaveError("Recording is too large (max 30 MB). Try a shorter memo.");
        return;
      }

      const signPayload = {
        songId,
        versionId,
        recordingId: id,
        name,
        mimeType: mime,
        durationSec: Math.max(0, durationSec),
        sizeBytes: pendingBlob.size,
      };

      const signRes = await fetch("/api/draft-recordings/upload-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signPayload),
      });
      const signData = (await signRes.json().catch(() => ({}))) as {
        error?: string;
        bucket?: string;
        path?: string;
        token?: string;
        recording?: DraftRecordingMeta;
      };
      if (!signRes.ok || !signData.recording || !signData.bucket || !signData.path || !signData.token) {
        throw new Error(
          typeof signData.error === "string" ? signData.error : "Could not start upload.",
        );
      }

      const supabase = createClient();
      const uploadAttempts = 3;
      let lastUploadMsg = "Upload failed.";
      for (let attempt = 0; attempt < uploadAttempts; attempt++) {
        const { error: upErr } = await supabase.storage
          .from(signData.bucket)
          .uploadToSignedUrl(signData.path, signData.token, pendingBlob, {
            contentType: mime,
            upsert: false,
          });
        if (!upErr) {
          onRecordingsChange([signData.recording, ...recordings]);
          void fetchSignedUrl(signData.recording.objectPath);
          break;
        }
        lastUploadMsg = upErr.message || lastUploadMsg;
        if (attempt === uploadAttempts - 1) {
          throw new Error(lastUploadMsg);
        }
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
      discardPending();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save memo.");
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = async (rec: DraftRecordingMeta) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (loadedMemoId === rec.id) {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      try {
        await audio.play();
      } catch (e) {
        setLoadedMemoId(null);
        setSaveError(e instanceof Error ? e.message : "Playback failed.");
      }
      return;
    }

    setSaveError(null);
    revokeLastAudioUrl();
    audio.pause();
    setLoadedMemoId(null);
    setPlaybackTimeSec(0);
    setPlaybackDurationSec(0);

    try {
      let src: string;
      if (!rec.objectPath) {
        const blob = await idbGetRecording(rec.id);
        if (!blob) {
          setSaveError("This memo is missing from local storage.");
          return;
        }
        src = URL.createObjectURL(blob);
        lastObjectUrlRef.current = src;
      } else {
        src = await fetchSignedUrl(rec.objectPath);
        lastObjectUrlRef.current = src;
      }

      audio.src = src;
      setLoadedMemoId(rec.id);
      await audio.play();
    } catch (e) {
      setLoadedMemoId(null);
      setSaveError(e instanceof Error ? e.message : "Playback failed.");
    }
  };

  const seekPlaybackTo = useCallback(
    (sec: number) => {
      const audio = audioRef.current;
      if (!audio || loadedMemoId === null) return;
      const d =
        Number.isFinite(audio.duration) && audio.duration > 0 ?
          audio.duration
        : playbackDurationSec > 0 ? playbackDurationSec
        : 0;
      const clamped = d > 0 ? Math.min(Math.max(0, sec), d) : Math.max(0, sec);
      audio.currentTime = clamped;
      setPlaybackTimeSec(clamped);
    },
    [loadedMemoId, playbackDurationSec],
  );

  const finalizePointerScrub = useCallback(() => {
    const wasPointerScrub = scrubbingRef.current;
    const v = pendingScrubSecRef.current;
    const resumeAfter = wasPlayingBeforePointerScrubRef.current;
    scrubbingRef.current = false;
    setScrubbing(false);
    setScrubPreviewSec(null);
    pendingScrubSecRef.current = null;
    if (!wasPointerScrub || v == null || !Number.isFinite(v)) {
      wasPlayingBeforePointerScrubRef.current = false;
      return;
    }
    wasPlayingBeforePointerScrubRef.current = false;
    seekPlaybackTo(v);
    if (resumeAfter) {
      const a = audioRef.current;
      if (a) void a.play().catch(() => {});
    }
  }, [seekPlaybackTo]);

  useEffect(() => {
    if (!scrubbing) return;
    window.addEventListener("pointerup", finalizePointerScrub);
    window.addEventListener("pointercancel", finalizePointerScrub);
    return () => {
      window.removeEventListener("pointerup", finalizePointerScrub);
      window.removeEventListener("pointercancel", finalizePointerScrub);
    };
  }, [scrubbing, finalizePointerScrub]);

  useEffect(() => {
    if (loadedMemoId === null) {
      wasPlayingBeforePointerScrubRef.current = false;
    }
  }, [loadedMemoId]);

  const downloadRecording = useCallback(
    async (rec: DraftRecordingMeta) => {
      setSaveError(null);
      setDownloadingId(rec.id);
      try {
        let blob: Blob;
        if (!rec.objectPath) {
          const b = await idbGetRecording(rec.id);
          if (!b) {
            setSaveError("This memo is missing from local storage.");
            return;
          }
          blob = b;
        } else {
          const url = await fetchSignedUrl(rec.objectPath);
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error("Could not download this memo.");
          }
          blob = await res.blob();
        }
        const ext = fileExtFromMime(rec.mimeType || blob.type || "audio/webm");
        const base = sanitizeDownloadFilenameBase(rec.name);
        const filename = `${base}.${ext}`;
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Download failed.");
      } finally {
        setDownloadingId(null);
      }
    },
    [fetchSignedUrl],
  );

  const performRemoveRecording = async (rec: DraftRecordingMeta) => {
    setSaveError(null);
    setDeleteActionError(null);
    setDeletePending(true);
    try {
      if (rec.objectPath) {
        const res = await fetch("/api/draft-recordings/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath: rec.objectPath }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Delete failed",
          );
        }
      } else {
        await idbDeleteRecording(rec.id);
      }
      signCacheRef.current.delete(rec.objectPath);
      onRecordingsChange(recordings.filter((r) => r.id !== rec.id));
      if (loadedMemoId === rec.id) {
        audioRef.current?.pause();
        setLoadedMemoId(null);
        setAudioPlaying(false);
        setPlaybackTimeSec(0);
        setPlaybackDurationSec(0);
      }
      revokeLastAudioUrl();
      setDeleteConfirm(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete.";
      setDeleteActionError(msg);
      setSaveError(msg);
    } finally {
      setDeletePending(false);
    }
  };

  const commitRename = () => {
    if (!renameId) return;
    const trimmed = renameValue.trim().slice(0, 120);
    if (!trimmed) {
      setRenameId(null);
      return;
    }
    onRecordingsChange(
      recordings.map((r) => (r.id === renameId ? { ...r, name: trimmed } : r)),
    );
    setRenameId(null);
  };

  const chip =
    "inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg border border-zinc-700/90 bg-zinc-900/60 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-40";

  const panelBody = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
      {micError ?
        <p className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2 text-xs text-red-200/95">
          {micError}
        </p>
      : null}
      {saveError ?
        <p className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2 text-xs text-red-200/95">
          {saveError}
        </p>
      : null}

      <div className="flex flex-wrap items-center gap-2">
        {!recording ?
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || Boolean(pendingBlob) || uploading}
            className={`${chip} border-emerald-800/50 bg-emerald-950/35 px-4 py-2.5 text-sm font-medium text-emerald-100/95 hover:border-emerald-600/45 hover:bg-emerald-950/55`}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                aria-hidden
              />
              Record
            </span>
          </button>
        : <button
            type="button"
            onClick={stopRecording}
            className="flex min-h-[44px] touch-manipulation items-center gap-2 rounded-lg border border-red-800/55 bg-red-950/45 px-4 py-2.5 text-sm font-semibold text-red-100/95 shadow-[0_0_20px_rgba(239,68,68,0.12)] animate-pulse hover:bg-red-950/65"
          >
            <span className="relative flex h-3 w-3" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            Stop · {formatMmSs(elapsedSec)}
          </button>
        }
      </div>

      {pendingBlob ?
        <div className="rounded-lg border border-emerald-800/35 bg-emerald-950/20 p-3 ring-1 ring-emerald-900/25">
          <p className="mb-2 text-xs font-medium text-emerald-100/90">
            Name this memo
          </p>
          <input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            maxLength={120}
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-600/30"
            placeholder="e.g. Chorus melody idea"
            disabled={uploading}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void commitPending()}
              disabled={uploading}
              className="min-h-[44px] flex-1 touch-manipulation rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-500 disabled:opacity-50 sm:flex-none"
            >
              {uploading ? "Saving…" : "Save memo"}
            </button>
            <button
              type="button"
              onClick={discardPending}
              disabled={uploading}
              className={`${chip} min-h-[44px] flex-1 px-4 py-2.5 text-sm sm:flex-none`}
            >
              Discard
            </button>
          </div>
        </div>
      : null}

      {sorted.length === 0 && !pendingBlob ?
        <p className="py-2 text-center text-xs leading-relaxed text-zinc-500">
          Capture melody ideas, cadence, or scratch vocals while you write.
        </p>
      : null}

      <ul className="space-y-2 pb-1">
        {sorted.map((rec) => {
          const isLoaded = loadedMemoId === rec.id;
          const showPause = isLoaded && audioPlaying;
          const metaDuration =
            typeof rec.durationSec === "number" && rec.durationSec > 0 ?
              rec.durationSec
            : 0;
          const sliderMax =
            playbackDurationSec > 0 ? playbackDurationSec
            : metaDuration > 0 ? metaDuration
            : 1;
          const displaySec =
            isLoaded ?
              scrubPreviewSec !== null ?
                Math.min(scrubPreviewSec, sliderMax)
              : Math.min(playbackTimeSec, sliderMax)
            : 0;
          const fillPct =
            isLoaded && sliderMax > 0 ? (displaySec / sliderMax) * 100 : 0;

          return (
          <li
            key={rec.id}
            className="flex items-stretch gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/35 p-2"
          >
            <button
              type="button"
              onClick={() => void togglePlay(rec)}
              disabled={disabled}
              className={`${chip} h-auto w-11 shrink-0`}
              aria-label={showPause ? "Pause" : "Play"}
            >
              {showPause ?
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              : <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 5v14l11-7L8 5Z" />
                </svg>
              }
            </button>
            <div className="min-w-0 flex-1 py-0.5">
              {renameId === rec.id ?
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenameId(null);
                  }}
                  maxLength={120}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-emerald-700/50"
                />
              : <button
                  type="button"
                  onClick={() => {
                    setRenameId(rec.id);
                    setRenameValue(rec.name);
                  }}
                  className="block w-full truncate text-left text-sm font-medium text-zinc-100 touch-manipulation hover:text-emerald-100/90"
                >
                  {rec.name}
                </button>
              }
              {isLoaded ?
                <div className="mt-0.5 flex min-h-[22px] items-center gap-2">
                  <span className="min-w-[2.75rem] shrink-0 text-[11px] leading-none tabular-nums text-zinc-400">
                    {formatMmSs(displaySec)}
                  </span>
                  <input
                    type="range"
                    aria-label={`Seek within ${rec.name}`}
                    className="voice-memo-scrubber min-w-0 flex-1 cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-40"
                    style={
                      { "--fill": `${fillPct}%` } as CSSProperties & {
                        "--fill": string;
                      }
                    }
                    min={0}
                    max={sliderMax}
                    step={0.02}
                    value={displaySec}
                    disabled={disabled}
                    onPointerDown={() => {
                      const audio = audioRef.current;
                      wasPlayingBeforePointerScrubRef.current = Boolean(
                        audio && !audio.paused,
                      );
                      if (audio && !audio.paused) {
                        audio.pause();
                      }
                      const t =
                        audio && Number.isFinite(audio.currentTime) ?
                          audio.currentTime
                        : playbackTimeSec;
                      const capped = Math.min(Math.max(0, t), sliderMax);
                      pendingScrubSecRef.current = capped;
                      setScrubPreviewSec(capped);
                      scrubbingRef.current = true;
                      setScrubbing(true);
                    }}
                    onPointerUp={() => finalizePointerScrub()}
                    onPointerCancel={() => finalizePointerScrub()}
                    onInput={(e) => {
                      const v = parseFloat(e.currentTarget.value);
                      if (!Number.isFinite(v)) return;
                      pendingScrubSecRef.current = v;
                      if (scrubbingRef.current) {
                        setScrubPreviewSec(v);
                      } else {
                        seekPlaybackTo(v);
                      }
                    }}
                  />
                  <span className="min-w-[2.75rem] shrink-0 text-right text-[11px] leading-none tabular-nums text-zinc-500">
                    {sliderMax > 0 ? formatMmSs(sliderMax) : "—:—"}
                  </span>
                </div>
              : <p className="mt-0.5 flex min-h-[22px] items-center text-[11px] leading-snug tabular-nums text-zinc-500">
                  {new Date(rec.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {typeof rec.durationSec === "number" ?
                    ` · ${formatMmSs(rec.durationSec)}`
                  : null}
                </p>
              }
            </div>
            <div className="flex shrink-0 items-stretch gap-1">
              <button
                type="button"
                onClick={() => void downloadRecording(rec)}
                disabled={disabled || downloadingId === rec.id}
                className={`${chip} h-auto w-11 shrink-0 border-zinc-600/80 text-zinc-400 hover:border-emerald-800/50 hover:bg-emerald-950/25 hover:text-emerald-200/95 disabled:opacity-50`}
                aria-label={`Download ${rec.name}`}
                aria-busy={downloadingId === rec.id}
              >
                {downloadingId === rec.id ?
                  <svg
                    className="animate-spin"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                    />
                  </svg>
                : <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                }
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteActionError(null);
                  setDeleteConfirm(rec);
                }}
                disabled={disabled || deletePending}
                className={`${chip} h-auto w-11 shrink-0 border-red-900/40 text-red-300/90 hover:border-red-800/55 hover:bg-red-950/35`}
                aria-label="Delete memo"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </li>
          );
        })}
      </ul>

    </div>
  );

  const overlay =
    panelOpen && mounted ?
      createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[125] cursor-default bg-black/50 backdrop-blur-[1px] lg:bg-black/25 lg:backdrop-blur-none"
            aria-label="Close voice notes"
            onClick={() => setPanelOpen(false)}
          />
          <div
            id="voice-notes-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-notes-title"
            className="fixed z-[130] flex max-h-[min(88dvh,720px)] flex-col overflow-hidden border border-zinc-700/85 bg-zinc-950 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-2xl max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-2xl max-lg:border-b-0 lg:max-h-[min(80dvh,640px)] lg:w-[min(calc(100vw-1.5rem),420px)] lg:rounded-xl lg:border lg:pb-0"
            style={
              wide ?
                {
                  top: anchor?.top ?? 72,
                  right: anchor?.right ?? 16,
                  bottom: "auto",
                  left: "auto",
                }
              : undefined
            }
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2.5">
              <div className="min-w-0">
                <h2
                  id="voice-notes-title"
                  className="truncate text-sm font-semibold text-zinc-100"
                >
                  Voice Notes
                </h2>
                <p className="truncate text-[11px] text-zinc-500">
                  {storageMode === "cloud" ?
                    "Saved with this version in the cloud"
                  : "Stored on this device"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-100"
                aria-label="Close"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {panelBody}
          </div>
        </>,
        document.body,
      )
    : null;

  const deleteDialog =
    deleteConfirm && mounted ?
      createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[140] bg-zinc-950/80 backdrop-blur-sm"
            aria-label="Cancel delete"
            disabled={deletePending}
            onClick={() => {
              if (!deletePending) setDeleteConfirm(null);
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-voice-memo-title"
            aria-describedby="delete-voice-memo-desc"
            className="fixed left-1/2 top-1/2 z-[145] w-[min(calc(100vw-2rem),380px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700/90 bg-zinc-950 px-5 pb-5 pt-5 shadow-[0_24px_64px_rgba(0,0,0,0.55)] ring-1 ring-emerald-900/15"
          >
            <h3
              id="delete-voice-memo-title"
              className="text-base font-semibold tracking-tight text-zinc-100"
            >
              Delete voice memo?
            </h3>
            <p
              id="delete-voice-memo-desc"
              className="mt-2 text-sm leading-relaxed text-zinc-400"
            >
              This can’t be undone. The recording{" "}
              <span className="break-words font-medium text-zinc-200">
                &ldquo;{deleteConfirm.name}&rdquo;
              </span>{" "}
              will be removed from this version.
            </p>
            {deleteActionError ?
              <p className="mt-3 rounded-lg border border-red-900/45 bg-red-950/30 px-3 py-2 text-xs text-red-200/95">
                {deleteActionError}
              </p>
            : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => setDeleteConfirm(null)}
                className="min-h-[44px] touch-manipulation rounded-lg border border-zinc-600/90 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={() => void performRemoveRecording(deleteConfirm)}
                className="min-h-[44px] touch-manipulation rounded-lg border border-red-800/55 bg-red-950/45 px-4 py-2.5 text-sm font-semibold text-red-100/95 shadow-sm transition hover:border-red-700/50 hover:bg-red-950/65 disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete memo"}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )
    : null;

  const count = recordings.length;

  return (
    <>
      <div
        className={`flex shrink-0 items-center gap-2 overflow-visible ${
          useMobileVoiceFab ? "hidden lg:flex" : ""
        }`}
      >
        <span className="hidden whitespace-nowrap text-xs font-medium uppercase tracking-wide text-zinc-500 lg:block">
          Record
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          disabled={disabled}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          aria-controls={panelOpen ? "voice-notes-dialog" : undefined}
          id="voice-notes-trigger"
          title="Voice notes"
          aria-label={
            count > 0 ?
              `Voice notes, ${count} saved`
            : "Open voice notes"
          }
          className="inline-flex h-9 min-h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-1.5 text-emerald-200/95 shadow-sm transition hover:border-emerald-800/50 hover:bg-emerald-950/35 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 lg:h-8 lg:min-h-8 lg:min-w-8"
        >
          <svg
            className="shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 22h8" />
          </svg>
          {count > 0 ?
            <span className="flex h-[18px] min-w-[18px] max-w-[30px] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold tabular-nums leading-none text-white ring-1 ring-zinc-900/90">
              {count > 99 ? "99+" : count}
            </span>
          : null}
        </button>
      </div>
      {mounted &&
      useMobileVoiceFab &&
      mobileFabVisible &&
      !suppressMobileFloatingFab ?
        createPortal(
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            disabled={disabled}
            title="Voice notes"
            aria-label={
              count > 0 ?
                `Voice notes, ${count} saved`
              : "Open voice notes"
            }
            className="relative fixed z-[60] flex h-14 w-14 touch-manipulation items-center justify-center rounded-full border border-emerald-800/55 bg-emerald-950/90 text-emerald-100 shadow-lg shadow-black/40 transition hover:border-emerald-600/60 hover:bg-emerald-900/95 disabled:cursor-not-allowed disabled:opacity-40 lg:hidden"
            style={{
              right:
                "calc(100% / 6 - 1.75rem + max(0px, env(safe-area-inset-right, 0px)))",
              bottom:
                "calc(4.75rem + env(safe-area-inset-bottom, 0px) + 0.5rem)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
              <path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 22h8" />
            </svg>
            {count > 0 ?
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-zinc-950">
                {count > 99 ? "99+" : count}
              </span>
            : null}
          </button>,
          document.body,
        )
      : null}
      {overlay}
      {deleteDialog}
      <audio ref={audioRef} className="hidden" playsInline preload="metadata" />
    </>
  );
});

DraftRecordingsPanel.displayName = "DraftRecordingsPanel";
