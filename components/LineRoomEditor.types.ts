import type {
  ChatMessage,
  CritiqueMeta,
  CritiqueResult,
  PriorVersionContext,
} from "@/lib/types";

export type LineRoomEditorLocalProps = { mode: "local" };

export type LineRoomEditorSongProps = {
  mode: "song";
  songId: string;
  songTitle: string;
  versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
  priorVersionsContext: PriorVersionContext[];
  activeVersionNumber: number;
  activeVersionId: string;
  initialDraftText: string;
  initialBrainstormText: string;
  initialChatMessages: ChatMessage[];
  initialCritique: CritiqueResult | null;
  initialMeta: CritiqueMeta;
  initialSaveSubRevision: number;
  initialShareToken: string | null;
  initialPublishedAt: string | null;
  initialPublishedFromVersionId: string | null;
  initialPublishedDraftText: string | null;
};

export type LineRoomEditorProps = LineRoomEditorLocalProps | LineRoomEditorSongProps;
