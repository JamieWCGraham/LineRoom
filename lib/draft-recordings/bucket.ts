export function getDraftRecordingsBucket(): string {
  return (
    process.env.SUPABASE_DRAFT_RECORDINGS_BUCKET?.trim() || "draft-recordings"
  );
}
