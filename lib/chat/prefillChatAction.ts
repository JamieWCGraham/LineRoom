import type { ChatAction, ChatScope, ChatSelectionPayload } from "@/types/chat";

function cleanWord(raw: string): string {
  const w = raw
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/gu, "");
  return w || "flat";
}

function lastWordFromPlainText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return cleanWord(words[words.length - 1] ?? "flat");
}

/** Last “word” in `text` for rhyme prompts (section tail, draft tail, etc.). */
export function extractRhymeAnchorWord(text: string): string {
  return lastWordFromPlainText(text);
}

function lastWordFromPins(pins: ChatSelectionPayload[]): string {
  const t = pins[0]?.text?.trim() ?? "";
  return lastWordFromPlainText(t || "flat");
}

type PrefillOpts = {
  multipleSelections?: boolean;
  pins: ChatSelectionPayload[];
  /** When set (e.g. section/full draft), used for Find rhymes instead of first pin. */
  rhymeTargetWord?: string;
};

export function prefillChatAction(
  action: ChatAction,
  scope: ChatScope,
  _sectionType: string | undefined,
  options: PrefillOpts,
): string {
  const multi = Boolean(options.multipleSelections);
  const pins = options.pins;

  switch (action) {
    case "find_rhymes": {
      const w =
        options.rhymeTargetWord?.trim() ?
          cleanWord(options.rhymeTargetWord.trim())
        : lastWordFromPins(pins);
      return `Find words that rhyme with "${w}".`;
    }
    case "suggest_rewrites": {
      if (scope === "selection") {
        return multi ?
            "Suggest rewrites or alternatives to these excerpts improving prosody while retaining meaning."
          : "Suggest rewrites or alternatives to this line improving prosody while retaining meaning.";
      }
      if (scope === "section") {
        return "Suggest rewrites or alternatives to this section improving prosody while retaining meaning.";
      }
      return "Suggest rewrites or alternatives to this draft improving prosody while retaining meaning.";
    }
    case "diagnose": {
      if (scope === "selection") {
        return multi ?
            "Give me other words that mean something similar to the main word or phrase in these excerpts."
          : "Give me other words that mean something similar to the main word or phrase in this selection.";
      }
      if (scope === "section") {
        return "Give me other words that mean something similar to the main word or phrase in this section.";
      }
      return "Give me other words that mean something similar to the main word or phrase in this draft.";
    }
  }
}
