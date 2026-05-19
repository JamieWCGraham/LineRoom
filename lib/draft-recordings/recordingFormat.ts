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

export const VOICE_MEMO_BITS_PER_SECOND = [128_000, 96_000, 64_000] as const;

export function pickRecorderMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
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
