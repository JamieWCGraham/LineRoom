import type { ChatActionResponse } from "@/types/chat";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  structured?: ChatActionResponse;
};

export type ChatRequest = {
  fullText: string;
  messages: ChatMessage[];
};

export type LineFeedbackItem = {
  quotedLine: string;
  feedback: string;
  category: "praise" | "constructive";
  strength?: "strong" | "promising" | "suggestion";
};

export type OverallRatingBand =
  | "Needs Work"
  | "Promising"
  | "Strong"
  | "Standout";

export type LyricDimension =
  | "emotional_impact"
  | "imagery_specificity"
  | "originality_voice"
  | "prosody_singability"
  | "structure_cohesion"
  | "lyrical_economy"
  | "hook_strength";

export type DimensionScore = 1 | 2 | 3 | 4 | 5;

export type LyricSubscores = Record<LyricDimension, DimensionScore>;

export type CritiqueResult = {
  genrePrinciples: string;
  overallRatingBand: OverallRatingBand;
  overallBandRationale?: string;
  subscores: LyricSubscores;
  overallStrengths: string[];
  overallWeaknesses: string[];
  lineFeedback: LineFeedbackItem[];
  /** Song version this critique was produced for (LineRoom song mode). */
  analyzedSongVersion?: number;
  /** Prior saved version whose draft/critique were used as comparison context, if any. */
  priorSongVersionCompared?: number | null;
  /** Short note on what the comparison baseline was (set by the server). */
  comparedToSummary?: string;
};

/** Voice memo attached to a draft version (Supabase Storage path or local IndexedDB). */
export type DraftRecordingMeta = {
  id: string;
  name: string;
  /** Bucket-relative path `{userId}/{songId}/{versionId}/{id}.ext`, or empty when stored locally only. */
  objectPath: string;
  mimeType: string;
  durationSec?: number;
  createdAt: string;
};

export type CritiqueMeta = {
  title: string;
  similarArtists: string;
  genre: string;
  draftRecordings?: DraftRecordingMeta[];
};

export type PriorVersionContext = {
  versionNumber: number;
  draftText: string;
  critique: CritiqueResult | null;
};
