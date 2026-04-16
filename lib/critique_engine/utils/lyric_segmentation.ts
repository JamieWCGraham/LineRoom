export type SegmentedLyricLine = {
  index: number;
  text: string;
  stanzaIndex?: number;
};

export type SegmentedLyric = {
  lines: SegmentedLyricLine[];
};

/**
 * Stable line indices (0-based) for span annotations. Blank lines are kept to preserve stanza gaps.
 */
export function segmentLyrics(fullText: string): SegmentedLyric {
  const rawLines = fullText.split("\n");
  let stanza = 0;
  const lines: SegmentedLyricLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i];
    if (i > 0 && rawLines[i - 1] === "" && text !== "") {
      stanza += 1;
    }
    lines.push({ index: i, text, stanzaIndex: stanza });
  }

  return { lines };
}

export function formatLyricsWithLineNumbers(segmented: SegmentedLyric): string {
  return segmented.lines
    .map((l) => `[${l.index}] ${l.text}`)
    .join("\n");
}
