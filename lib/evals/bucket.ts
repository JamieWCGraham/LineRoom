export function getLineRoomEvalsBucket(): string {
  return (
    process.env.SUPABASE_LINE_ROOM_EVALS_BUCKET?.trim() || "line-room-evals"
  );
}

export function evalOutputObjectPath(runTimestamp: string, evalSetId: number): string {
  return `${runTimestamp}/${evalSetId}/output.json`;
}
