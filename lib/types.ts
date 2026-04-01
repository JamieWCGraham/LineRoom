export const REWRITE_ACTIONS = [
  "Keep meaning, improve phrasing",
  "Less cliché",
  "More vivid",
  "Simpler / clearer",
  "More conversational",
  "More poetic",
  "Tighten",
  "Darker",
  "Generate alternates",
] as const;

export type RewriteAction = (typeof REWRITE_ACTIONS)[number];

export type RewriteRequest = {
  fullText: string;
  selectedText: string;
  action: RewriteAction;
  customInstruction?: string;
  voiceNotes?: string;
  contextBefore?: string;
  contextAfter?: string;
};

export type RewriteOption = {
  label: string;
  rationale: string;
  text: string;
};

export type RewriteResponse = {
  options: RewriteOption[];
};

export type CritiqueRequest = {
  fullText: string;
  selectedText: string;
  voiceNotes?: string;
  contextBefore?: string;
  contextAfter?: string;
};

export type CritiqueResponse = {
  strengths: string[];
  weaknesses: string[];
  strongestLine?: string;
  weakestLine?: string;
  clicheRisk?: string;
  emotionalClarity?: string;
  nextMove?: string;
};
