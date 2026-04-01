const DEFAULT_CONTEXT = 400;

export function getSurroundingContext(
  fullText: string,
  selectedText: string,
  maxChars = DEFAULT_CONTEXT,
): { contextBefore: string; contextAfter: string } {
  const i = fullText.indexOf(selectedText);
  if (i < 0) {
    return { contextBefore: "", contextAfter: "" };
  }
  const before = fullText.slice(0, i);
  const after = fullText.slice(i + selectedText.length);
  return {
    contextBefore: before.slice(-maxChars),
    contextAfter: after.slice(0, maxChars),
  };
}

export function replaceFirstOccurrence(
  fullText: string,
  selectedText: string,
  replacement: string,
): { ok: boolean; result: string } {
  const i = fullText.indexOf(selectedText);
  if (i < 0) {
    return { ok: false, result: fullText };
  }
  return {
    ok: true,
    result:
      fullText.slice(0, i) + replacement + fullText.slice(i + selectedText.length),
  };
}

export function insertBelowFirstOccurrence(
  fullText: string,
  selectedText: string,
  insertion: string,
): { ok: boolean; result: string } {
  const i = fullText.indexOf(selectedText);
  if (i < 0) {
    return { ok: false, result: fullText };
  }
  const end = i + selectedText.length;
  const atEnd = end >= fullText.length;
  const nextChar = atEnd ? "" : fullText[end];
  const sep =
    nextChar === "\n" || atEnd
      ? "\n"
      : fullText.slice(end).startsWith("\n\n")
        ? "\n"
        : "\n\n";
  return {
    ok: true,
    result:
      fullText.slice(0, end) + sep + insertion + fullText.slice(end),
  };
}
