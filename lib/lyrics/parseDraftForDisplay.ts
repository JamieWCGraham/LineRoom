import { parseSectionHeader } from "@/lib/chat/sectionFromDraft";

export type LyricStanza = string[];
export type LyricSection = {
  label: string | null;
  stanzas: LyricStanza[];
};

export type ParsedLyricDocument = {
  sections: LyricSection[];
};

/** Display label for a line that is a section header (bracketed or short labeled line). */
export function sectionDisplayLabel(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const bracket = trimmed.match(/^\[(.+?)\]\s*$/);
  if (bracket) return bracket[1].trim();

  if (!parseSectionHeader(trimmed)) return null;

  const headerOnly = trimmed.match(
    /^(verse|chorus|bridge|intro|outro|pre-chorus|hook|refrain)(?:\s+\d+)?\s*:?\s*$/i,
  );
  if (!headerOnly) return null;

  return trimmed.replace(/:\s*$/, "").trim();
}

function isSectionHeaderLine(line: string): boolean {
  return sectionDisplayLabel(line) !== null;
}

function flushStanza(section: LyricSection, stanza: string[]) {
  if (stanza.length > 0) {
    section.stanzas.push(stanza.slice());
    stanza.length = 0;
  }
}

function flushSection(sections: LyricSection[], section: LyricSection | null) {
  if (!section) return;
  if (section.label !== null || section.stanzas.length > 0) {
    sections.push(section);
  }
}

/**
 * Parse raw draft text into sections and stanzas for read-mode display.
 * Blank lines separate stanzas; bracketed or short section labels start a new section.
 */
export function parseDraftForDisplay(draftText: string): ParsedLyricDocument {
  const lines = draftText.replace(/\r\n/g, "\n").split("\n");
  const sections: LyricSection[] = [];
  let current: LyricSection | null = null;
  let stanza: string[] = [];

  const ensureSection = () => {
    if (!current) {
      current = { label: null, stanzas: [] };
    }
  };

  for (const line of lines) {
    const headerLabel = sectionDisplayLabel(line);
    if (headerLabel) {
      flushStanza(current ?? { label: null, stanzas: [] }, stanza);
      flushSection(sections, current);
      current = { label: headerLabel, stanzas: [] };
      stanza = [];
      continue;
    }

    if (!line.trim()) {
      ensureSection();
      flushStanza(current!, stanza);
      continue;
    }

    ensureSection();
    stanza.push(line);
  }

  if (current) {
    flushStanza(current, stanza);
    flushSection(sections, current);
  }

  if (sections.length === 0 && draftText.trim()) {
    const fallbackStanzas: LyricStanza[] = [];
    let block: string[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        if (block.length > 0) {
          fallbackStanzas.push(block);
          block = [];
        }
      } else {
        block.push(line);
      }
    }
    if (block.length > 0) fallbackStanzas.push(block);
    return { sections: [{ label: null, stanzas: fallbackStanzas }] };
  }

  return { sections };
}
