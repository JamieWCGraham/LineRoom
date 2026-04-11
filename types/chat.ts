import type { CritiqueResult } from "@/lib/types";

export type ChatAction =
  | "find_rhymes"
  | "suggest_rewrites"
  | "diagnose";

export type ChatScope = "selection" | "section" | "full_draft";

export type ChatSelectionPayload = {
  startLine: number;
  endLine: number;
  text: string;
};

export type ChatSectionPayload = {
  type: string;
  text: string;
};

export type ChatActionPayload = {
  action: ChatAction;
  scope: ChatScope;
  userMessage: string;
  draft: string;
  critique?: CritiqueResult;
  /** One or more draft excerpts when scope is `selection`. */
  selections?: ChatSelectionPayload[];
  section?: ChatSectionPayload;
};

/** Saved sessions may still contain legacy assistant `mode` values. */
export type ChatActionResponseMode =
  | ChatAction
  | "rewrite"
  | "hook";

export type ChatActionResponse = {
  mode: ChatActionResponseMode;
  scope: ChatScope;
  summary: string;
  diagnosis?: string[];
  options?: string[];
  recommendedOption?: number | null;
};

export type DraftEditorContext = {
  selection: ChatSelectionPayload | null;
  caretLine: number;
};
