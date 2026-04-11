import type {
  ChatAction,
  ChatActionPayload,
  ChatScope,
  ChatSectionPayload,
  ChatSelectionPayload,
} from "@/types/chat";
import type { CritiqueResult } from "@/lib/types";

type Args = {
  action: ChatAction;
  scope: ChatScope;
  draft: string;
  critique?: CritiqueResult;
  selections?: ChatSelectionPayload[] | null;
  section?: ChatSectionPayload | null;
  userMessage: string;
};

export function buildChatActionPayload({
  action,
  scope,
  draft,
  critique,
  selections,
  section,
  userMessage,
}: Args): ChatActionPayload {
  const payload: ChatActionPayload = {
    action,
    scope,
    userMessage,
    draft,
    critique,
  };
  const nonEmpty =
    selections?.filter((s) => s.text?.trim()) ?? [];
  if (nonEmpty.length > 0 && scope === "selection") {
    payload.selections = nonEmpty;
  }
  if (section && scope === "section") {
    payload.section = section;
  }
  return payload;
}
