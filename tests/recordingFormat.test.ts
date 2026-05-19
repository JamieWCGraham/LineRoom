import { describe, expect, it } from "vitest";
import {
  fileExtFromMime,
  formatMmSs,
  sanitizeDownloadFilenameBase,
} from "@/lib/draft-recordings/recordingFormat";

describe("recordingFormat", () => {
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
});
