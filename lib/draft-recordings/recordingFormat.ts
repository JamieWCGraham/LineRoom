export function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function fileExtFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  return "webm";
}

export function sanitizeDownloadFilenameBase(name: string): string {
  const t = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");
  const s = t.slice(0, 120);
  return s.length ? s : "voice-memo";
}

/** Prefer high AAC/Opus bitrates; never fall to phone-call 64 kbps. */
export const VOICE_MEMO_BITS_PER_SECOND = [256_000, 192_000, 128_000] as const;

export function isAppleAudioPlatform(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  if (/LineRoomNativeShell\/iOS/i.test(userAgent)) return true;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // Mac Safari / WKWebView — same MP4 MediaRecorder path as iOS.
  if (/Macintosh|Mac OS X/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg\//i.test(userAgent)) {
    return true;
  }
  return false;
}

/**
 * Voice Memos–style capture: no echo cancellation / AGC / NS (those duck and
 * color scratch vocals like a phone call).
 */
export function voiceMemoAudioConstraints(): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48_000 },
  };
  // Newer Safari: voiceIsolation forces call-style processing when enabled.
  (constraints as MediaTrackConstraints & { voiceIsolation?: ConstrainBoolean }).voiceIsolation =
    false;
  return constraints;
}

export function pickRecorderMime(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): string {
  const apple = isAppleAudioPlatform(userAgent);
  const candidates = apple
    ? ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}

export function instantiateMediaRecorder(
  stream: MediaStream,
  mime: string,
): MediaRecorder {
  if (!mime) {
    return new MediaRecorder(stream);
  }
  const withMime: MediaRecorderOptions = { mimeType: mime };
  for (const bps of VOICE_MEMO_BITS_PER_SECOND) {
    try {
      return new MediaRecorder(stream, { ...withMime, audioBitsPerSecond: bps });
    } catch {
      /* browser may reject explicit bitrate for this mime */
    }
  }
  try {
    return new MediaRecorder(stream, withMime);
  } catch {
    return new MediaRecorder(stream);
  }
}

/**
 * Start without a timeslice so WebKit emits one complete MP4/AAC blob on stop.
 * Short timeslices (< ~1s) corrupt concatenated MP4 segments on iOS Safari.
 */
export function startVoiceMemoRecorder(recorder: MediaRecorder): void {
  recorder.start();
}
