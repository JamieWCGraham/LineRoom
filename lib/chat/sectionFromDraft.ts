export function parseSectionHeader(line: string): string | null {
  const b = line.trim();
  if (!b) return null;
  const bracket = b.match(/^\[(.+?)\]\s*$/);
  if (bracket) {
    return bracket[1].trim().toLowerCase().replace(/\s+/g, " ");
  }
  const label = b.match(
    /^(verse|chorus|bridge|intro|outro|pre-chorus|hook|refrain)\b/i,
  );
  if (label) return label[1].toLowerCase();
  return null;
}

/** Section block containing `lineIndex` (0-based), including its header line when present. */
export function getSectionForLine(
  fullText: string,
  lineIndex: number,
): { type: string; text: string } {
  const lines = fullText.split("\n");
  if (lines.length === 0) {
    return { type: "draft", text: "" };
  }
  const idx = Math.max(0, Math.min(lineIndex, lines.length - 1));

  let sectionStart = 0;
  let sectionType = "draft";
  for (let i = idx; i >= 0; i -= 1) {
    const parsed = parseSectionHeader(lines[i]);
    if (parsed) {
      sectionStart = i;
      sectionType = parsed;
      break;
    }
  }

  let sectionEnd = lines.length;
  for (let j = sectionStart + 1; j < lines.length; j += 1) {
    if (parseSectionHeader(lines[j])) {
      sectionEnd = j;
      break;
    }
  }

  return {
    type: sectionType,
    text: lines.slice(sectionStart, sectionEnd).join("\n"),
  };
}
