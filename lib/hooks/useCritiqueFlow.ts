"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CritiqueAccessState } from "@/lib/billing/types";
import {
  saveNewSongVersion,
  updateSongVersionState,
} from "@/lib/songs/actions";
import { buildAutosavePayloadString } from "@/lib/songs/persist";
import type {
  ChatMessage,
  CritiqueMeta,
  CritiqueResult,
  PriorVersionContext,
} from "@/lib/types";

export type SongCritiqueSource = {
  activeVersionNumber: number;
  initialDraftText: string;
  initialCritique: CritiqueResult | null;
};

export type UseCritiqueFlowArgs = {
  isSong: boolean;
  songId: string | null;
  activeVersionId: string | null;
  serverSubRevision: number;
  onServerSubRevision: (n: number) => void;
  fullText: string;
  brainstormText: string;
  chatMessages: ChatMessage[];
  critique: CritiqueResult | null;
  meta: CritiqueMeta;
  pieceTitle: string;
  priorVersionsContext: PriorVersionContext[];
  songCritiqueSource: SongCritiqueSource | null;
  persistSongState: (
    nextCritique?: CritiqueResult | null,
  ) => Promise<{ ok: boolean; message?: string }>;
  setVersionRowPersistLock: (locked: boolean) => void;
  markLastPersisted: (payloadStr: string) => void;
  setSaveError: (msg: string | null) => void;
  setCritique: (c: CritiqueResult | null) => void;
  waitForPersistChain: () => Promise<void>;
};

/** Regeneration keeps version history; first critique updates the current row in place. */
export function shouldBumpVersionAfterCritique(
  regenerate: boolean,
  existingCritique: CritiqueResult | null,
): boolean {
  return regenerate && existingCritique != null;
}

export function useCritiqueFlow(args: UseCritiqueFlowArgs) {
  const router = useRouter();
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);
  const [critiqueAccess, setCritiqueAccess] = useState<CritiqueAccessState | null>(
    null,
  );
  const [paywallOpen, setPaywallOpen] = useState(false);
  const critiqueInFlightRef = useRef(false);

  const quotaBadge = useMemo(() => {
    if (!critiqueAccess) return null;
    if (critiqueAccess.hasActiveSubscription) return "Pro";
    if (critiqueAccess.isBypassed) return null;
    return `Free: ${critiqueAccess.remainingFreeCritiques} left`;
  }, [critiqueAccess]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/access");
        const data = (await res.json()) as { access?: CritiqueAccessState };
        if (!cancelled && data.access) setCritiqueAccess(data.access);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runCritique = useCallback(
    async (options?: { regenerate?: boolean }) => {
      if (critiqueInFlightRef.current) return;
      critiqueInFlightRef.current = true;
      const regenerate = options?.regenerate ?? false;
      if (!args.fullText.trim()) {
        critiqueInFlightRef.current = false;
        return;
      }
      const priorCritiqueForPayload =
        regenerate && args.critique ? args.critique : undefined;

      const priorVersionsPayload =
        args.isSong && args.songCritiqueSource ?
          args.priorVersionsContext.length > 0 ?
            args.priorVersionsContext
          : regenerate ?
            [
              {
                versionNumber: args.songCritiqueSource.activeVersionNumber,
                draftText: args.songCritiqueSource.initialDraftText,
                critique: args.songCritiqueSource.initialCritique,
              },
            ]
          : []
        : [];

      const analyzedSongVersion =
        args.isSong && args.songCritiqueSource ?
          args.songCritiqueSource.activeVersionNumber
        : undefined;
      const priorSongVersionCompared =
        args.isSong ?
          args.priorVersionsContext.length > 0 ?
            args.priorVersionsContext[0]!.versionNumber
          : null
        : undefined;

      setCritiqueError(null);
      args.setSaveError(null);
      setCritiqueLoading(true);
      try {
        if (args.isSong) {
          await args.waitForPersistChain();
        }
        const res = await fetch("/api/critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullText: args.fullText,
            title: args.pieceTitle,
            similarArtists: args.meta.similarArtists,
            genre: args.meta.genre,
            priorVersions: priorVersionsPayload,
            regenerate: regenerate || undefined,
            priorCritique: priorCritiqueForPayload,
            analyzedSongVersion,
            priorSongVersionCompared,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          critique?: CritiqueResult;
          access?: CritiqueAccessState;
          code?: string;
        };
        if (data.access) setCritiqueAccess(data.access);
        if (res.status === 402 && data.code === "PAYWALL_REQUIRED") {
          setCritiqueError(null);
          setPaywallOpen(true);
          return null;
        }
        if (!res.ok) {
          setCritiqueError(
            typeof data.error === "string" ? data.error : "Critique failed.",
          );
          return null;
        }
        if (!data.critique) {
          setCritiqueError("Missing critique in response.");
          return null;
        }

        const existingCritique = args.critique;
        const nextCritique = data.critique;
        args.setCritique(nextCritique);

        if (args.isSong && args.songId && args.activeVersionId) {
          const bumpVersion = shouldBumpVersionAfterCritique(
            regenerate,
            existingCritique,
          );

          if (!bumpVersion) {
            const persistResult = await args.persistSongState(nextCritique);
            if (!persistResult.ok && persistResult.message !== "locked") {
              args.setSaveError(persistResult.message ?? null);
            }
            return nextCritique;
          }

          args.setVersionRowPersistLock(true);
          try {
            const payload = {
              draft_text: args.fullText,
              brainstorm_text: args.brainstormText,
              chat_messages: args.chatMessages,
              critique: nextCritique,
              meta: args.meta,
            };
            const saveCurrentResult = await updateSongVersionState(
              args.songId,
              args.activeVersionId,
              payload,
              { expectedSubRevision: args.serverSubRevision },
            );
            if (!saveCurrentResult.ok) {
              args.setSaveError(saveCurrentResult.message);
              return null;
            }
            args.onServerSubRevision(saveCurrentResult.newSubRevision);
            args.markLastPersisted(buildAutosavePayloadString({
              draftText: payload.draft_text,
              brainstormText: payload.brainstorm_text,
              chatMessages: payload.chat_messages,
              critique: payload.critique,
              meta: payload.meta,
            }));
            const bumpResult = await saveNewSongVersion(args.songId, payload);
            if (!bumpResult.ok) {
              args.setSaveError(bumpResult.message);
              return null;
            }
            router.replace(`/song/${args.songId}?v=${bumpResult.versionId}`);
            await router.refresh();
          } finally {
            args.setVersionRowPersistLock(false);
          }
        } else if (args.isSong) {
          const persistResult = await args.persistSongState(nextCritique);
          if (!persistResult.ok && persistResult.message !== "locked") {
            args.setSaveError(persistResult.message ?? null);
          }
        }
        return nextCritique;
      } catch {
        setCritiqueError("Network error.");
        return null;
      } finally {
        setCritiqueLoading(false);
        critiqueInFlightRef.current = false;
        if (args.isSong) {
          args.setVersionRowPersistLock(false);
        }
      }
    },
    [args, router],
  );

  const requestCritique = useCallback(
    async (opts?: { regenerate?: boolean }) => {
      if (critiqueAccess && !critiqueAccess.canGenerateCritique) {
        setPaywallOpen(true);
        return null;
      }
      return runCritique(opts);
    },
    [critiqueAccess, runCritique],
  );

  return {
    critiqueLoading,
    critiqueError,
    critiqueAccess,
    paywallOpen,
    setPaywallOpen,
    quotaBadge,
    requestCritique,
    runCritique,
  };
}
