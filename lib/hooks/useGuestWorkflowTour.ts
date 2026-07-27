"use client";

import { useCallback, useEffect, useState } from "react";
import type { MobilePane } from "@/lib/hooks/useLineRoomLayout";
import {
  type GuestWorkflowTourStep,
  readGuestWorkflowTourDismissed,
  writeGuestWorkflowTourDismissed,
} from "@/lib/onboarding/guestWorkflowTour";

type Args = {
  enabled: boolean;
  /** When true (e.g. paywall open), hide the tour without dismissing. */
  paused?: boolean;
  setMobilePane: (pane: MobilePane) => void;
};

export function useGuestWorkflowTour({
  enabled,
  paused = false,
  setMobilePane,
}: Args) {
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [step, setStep] = useState<GuestWorkflowTourStep>(1);

  useEffect(() => {
    setDismissed(readGuestWorkflowTourDismissed());
    setHydrated(true);
  }, []);

  const open = hydrated && enabled && !dismissed && !paused;

  useEffect(() => {
    if (!open) return;
    setMobilePane(step === 1 ? "draft" : "critique");
  }, [open, step, setMobilePane]);

  const dismiss = useCallback(() => {
    writeGuestWorkflowTourDismissed();
    setDismissed(true);
  }, []);

  const next = useCallback(() => {
    setStep(2);
  }, []);

  const back = useCallback(() => {
    setStep(1);
  }, []);

  return { open, step, next, back, dismiss };
}
