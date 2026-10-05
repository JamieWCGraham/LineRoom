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

/** Match the mic constraint so the upmix graph does not resample. */
export const VOICE_MEMO_SAMPLE_RATE = 48_000;

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
    sampleRate: { ideal: VOICE_MEMO_SAMPLE_RATE },
  };
  // Newer Safari: voiceIsolation forces call-style processing when enabled.
  (constraints as MediaTrackConstraints & { voiceIsolation?: ConstrainBoolean }).voiceIsolation =
    false;
  return constraints;
}

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | undefined {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * Create the recording context on the user-gesture turn. Prefer 48 kHz so the
 * graph matches the mic constraint; fall back to the device rate if 48 kHz is
 * refused. No processing nodes are added.
 */
export function createVoiceMemoAudioContext(
  sampleRate: number = VOICE_MEMO_SAMPLE_RATE,
): AudioContext {
  const Ctor = audioContextConstructor();
  if (!Ctor) {
    throw new Error("Web Audio is not available");
  }
  try {
    return new Ctor({ sampleRate });
  } catch {
    return new Ctor();
  }
}

export type StereoVoiceMemoCapture = {
  /** Dual-mono stream for MediaRecorder. */
  stream: MediaStream;
  /** Stop the mic, the upmix, and the context. Safe to call more than once. */
  dispose: () => void;
};

/**
 * MediaRecorder writes a one-channel mic into a stereo file on the left
 * channel only. Copy that channel to left and right at unity gain — a
 * ChannelSplitter, not a stereo downmix — so both speakers get the same
 * signal without halving the level or changing the sample rate.
 */
export function createStereoVoiceMemoCapture(
  micStream: MediaStream,
  audioContext: AudioContext,
): StereoVoiceMemoCapture {
  const source = audioContext.createMediaStreamSource(micStream);
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);
  const destination = audioContext.createMediaStreamDestination();

  destination.channelCount = 2;
  destination.channelCountMode = "explicit";

  source.connect(splitter);
  splitter.connect(merger, 0, 0);
  splitter.connect(merger, 0, 1);
  merger.connect(destination);

  let disposed = false;
  return {
    stream: destination.stream,
    dispose() {
      if (disposed) return;
      disposed = true;
      source.disconnect();
      splitter.disconnect();
      merger.disconnect();
      for (const track of micStream.getTracks()) track.stop();
      for (const track of destination.stream.getTracks()) track.stop();
      void audioContext.close().catch(() => {});
    },
  };
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
