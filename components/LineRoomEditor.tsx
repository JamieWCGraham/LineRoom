"use client";

export type {
  LineRoomEditorLocalProps,
  LineRoomEditorProps,
  LineRoomEditorSongProps,
} from "@/components/LineRoomEditor.types";
import type { LineRoomEditorProps } from "@/components/LineRoomEditor.types";
import { LineRoomEditorLayout } from "@/components/lineroom/LineRoomEditorLayout";
import { useLineRoomEditorState } from "@/lib/hooks/useLineRoomEditorState";

export function LineRoomEditor(props: LineRoomEditorProps) {
  const vm = useLineRoomEditorState(props);
  return <LineRoomEditorLayout {...vm} />;
}
