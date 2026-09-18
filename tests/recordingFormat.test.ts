import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileExtFromMime,
  formatMmSs,
  isAppleAudioPlatform,
  pickRecorderMime,
  sanitizeDownloadFilenameBase,
  startVoiceMemoRecorder,
  VOICE_MEMO_BITS_PER_SECOND,
  voiceMemoAudioConstraints,
} from "@/lib/draft-recordings/recordingFormat";

describe("recordingFormat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats seconds as mm:ss", () => {
    expect(formatMmSs(65)).toBe("1:05");
    expect(formatMmSs(0)).toBe("0:00");
  });

  it("maps mime types to extensions", () => {
    expect(fileExtFromMime("audio/webm")).toBe("webm");
    expect(fileExtFromMime("audio/mp4")).toBe("m4a");
  });

  it("sanitizes download filenames", () => {
    expect(sanitizeDownloadFilenameBase("  my/recording  ")).toBe("my-recording");
    expect(sanitizeDownloadFilenameBase("")).toBe("voice-memo");
  });

  it("uses a high bitrate ladder without 64 kbps", () => {
    expect([...VOICE_MEMO_BITS_PER_SECOND]).toEqual([256_000, 192_000, 128_000]);
    expect(VOICE_MEMO_BITS_PER_SECOND.includes(64_000 as never)).toBe(false);
  });

  it("detects Apple audio platforms", () => {
    expect(
      isAppleAudioPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
    expect(
      isAppleAudioPlatform(
        "Mozilla/5.0 LineRoomNativeShell/iOS CapacitorWebView",
      ),
    ).toBe(true);
    expect(
      isAppleAudioPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe(true);
    expect(
      isAppleAudioPlatform(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("prefers audio/mp4 on Apple when supported", () => {
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: (mime: string) =>
        mime === "audio/mp4" || mime.startsWith("audio/webm"),
    });
    expect(
      pickRecorderMime(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("audio/mp4");
  });

  it("prefers webm/opus on non-Apple when supported", () => {
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: (mime: string) =>
        mime === "audio/webm;codecs=opus" ||
        mime === "audio/webm" ||
        mime === "audio/mp4",
    });
    expect(
      pickRecorderMime(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe("audio/webm;codecs=opus");
  });

  it("disables call-style mic processing in voice memo constraints", () => {
    const c = voiceMemoAudioConstraints();
    expect(c.echoCancellation).toBe(false);
    expect(c.noiseSuppression).toBe(false);
    expect(c.autoGainControl).toBe(false);
    expect(
      (c as MediaTrackConstraints & { voiceIsolation?: boolean }).voiceIsolation,
    ).toBe(false);
  });

  it("starts MediaRecorder without a timeslice", () => {
    const start = vi.fn();
    startVoiceMemoRecorder({ start } as unknown as MediaRecorder);
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith();
  });
});
