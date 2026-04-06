import type { LineFeedbackItem } from "@/lib/types";

export function buildLineFeedbackByIndex(
  draft: string,
  items: LineFeedbackItem[],
): Map<number, string[]> {
  const lines = draft.split("\n");
  const map = new Map<number, string[]>();

  for (const item of items) {
    const q = item.quotedLine;
    const qTrim = q.trim();

    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === q) {
        idx = i;
        break;
      }
    }
    if (idx === -1 && qTrim.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === qTrim) {
          idx = i;
          break;
        }
      }
    }
    if (idx === -1 && qTrim.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        if (L.includes(q) || q.includes(L)) {
          idx = i;
          break;
        }
      }
    }
    if (idx === -1) continue;

    const list = map.get(idx) ?? [];
    list.push(item.feedback);
    map.set(idx, list);
  }
  return map;
}
