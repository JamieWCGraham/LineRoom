import type { LineFeedbackItem } from "@/lib/types";

export type LineAnnotation = {
  feedback: string;
  category: LineFeedbackItem["category"];
  strength: "strong" | "promising" | "suggestion";
};

/**
 * Normalize for comparing model `quotedLine` to draft lines: smart quotes, runs of
 * whitespace, trim. Does not strip intentional leading spaces before first word —
 * use raw equality first in the resolver; this is for fallbacks.
 */
export function normalizeLineForMatch(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function similarityRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const d = levenshteinDistance(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

const FUZZY_MIN_QUOTE_LEN = 10;
const FUZZY_MIN_SCORE = 0.88;
const MAX_FUZZY_LEN = 400;

/**
 * Resolve which draft line(s) a `quotedLine` refers to. Avoids the old
 * `includes`-on-first-hit behavior that pinned short quotes to the wrong line.
 */
export function resolveLineIndicesForQuote(
  lines: string[],
  rawQuote: string,
): number[] {
  const q = rawQuote;
  const qTrim = q.trim();
  if (qTrim.length === 0) return [];

  const exact: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === q) exact.push(i);
  }
  if (exact.length > 0) return exact;

  const trimHits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === qTrim) trimHits.push(i);
  }
  if (trimHits.length > 0) return trimHits;

  const qNorm = normalizeLineForMatch(q);
  if (qNorm.length === 0) return [];

  const normHits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (normalizeLineForMatch(lines[i]) === qNorm) normHits.push(i);
  }
  if (normHits.length > 0) return normHits;

  /** Quote is almost the full normalized line (model dropped ends / merged spaces). */
  const MIN_SUB_LEN = 18;
  const MIN_FRAC_OF_LINE = 0.58;
  for (let i = 0; i < lines.length; i++) {
    const Ln = normalizeLineForMatch(lines[i]);
    if (Ln.length < MIN_SUB_LEN) continue;
    if (qNorm.length < MIN_SUB_LEN) continue;
    if (Ln.includes(qNorm) && qNorm.length >= Ln.length * MIN_FRAC_OF_LINE) {
      return [i];
    }
  }

  let bestI = -1;
  let bestScore = 0;
  const qa =
    qNorm.length > MAX_FUZZY_LEN ? qNorm.slice(0, MAX_FUZZY_LEN) : qNorm;
  for (let i = 0; i < lines.length; i++) {
    let Ln = normalizeLineForMatch(lines[i]);
    if (Ln.length === 0) continue;
    if (Ln.length > MAX_FUZZY_LEN) Ln = Ln.slice(0, MAX_FUZZY_LEN);
    const lenRatio =
      Math.min(qa.length, Ln.length) / Math.max(qa.length, Ln.length, 1);
    if (lenRatio < 0.45) continue;
    const score = similarityRatio(qa, Ln);
    if (score > bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  if (
    bestI >= 0 &&
    bestScore >= FUZZY_MIN_SCORE &&
    qNorm.length >= FUZZY_MIN_QUOTE_LEN
  ) {
    return [bestI];
  }

  return [];
}

export function buildLineFeedbackByIndex(
  draft: string,
  items: LineFeedbackItem[],
): Map<number, LineAnnotation[]> {
  const lines = draft.split("\n");
  const map = new Map<number, LineAnnotation[]>();

  for (const item of items) {
    const indices = resolveLineIndicesForQuote(lines, item.quotedLine);
    if (indices.length === 0) continue;

    const annotation: LineAnnotation = {
      feedback: item.feedback,
      category: item.category,
      strength:
        item.strength ??
        (item.category === "praise" ? "strong" : "suggestion"),
    };

    for (const idx of indices) {
      const list = map.get(idx) ?? [];
      list.push(annotation);
      map.set(idx, list);
    }
  }
  return map;
}
