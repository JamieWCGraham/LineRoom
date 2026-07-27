/** localStorage flag — guest trial spotlight tour dismissed/completed. */
export const GUEST_WORKFLOW_TOUR_DISMISSED_KEY =
  "lineroom_guest_workflow_tour_dismissed";

export type GuestWorkflowTourStep = 1 | 2;

export const GUEST_WORKFLOW_TOUR_TARGETS = {
  draft: "draft",
  generateCritique: "generate-critique",
} as const;

export function readGuestWorkflowTourDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(GUEST_WORKFLOW_TOUR_DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeGuestWorkflowTourDismissed(): void {
  try {
    localStorage.setItem(GUEST_WORKFLOW_TOUR_DISMISSED_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}
