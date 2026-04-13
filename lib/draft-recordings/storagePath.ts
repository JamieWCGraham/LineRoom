export function buildDraftRecordingObjectPath(
  userId: string,
  songId: string,
  versionId: string,
  recordingId: string,
  ext: string,
): string {
  const uid = userId.trim();
  const safeExt = ext.replace(/^\./, "").replace(/[^a-z0-9]/gi, "") || "bin";
  return `${uid}/${songId}/${versionId}/${recordingId}.${safeExt}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidSegment(s: string): boolean {
  return UUID_RE.test(s.trim());
}
