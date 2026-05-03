export type CritiqueAccessReason =
  | "bypassed"
  | "subscribed"
  | "free_remaining"
  | "quota_exhausted"
  | "unauthenticated";

export type CritiqueAccessState = {
  isBypassed: boolean;
  hasActiveSubscription: boolean;
  freeQuota: number;
  usedFreeCritiques: number;
  remainingFreeCritiques: number;
  canGenerateCritique: boolean;
  reason: CritiqueAccessReason;
  /** Present when the user has an active subscription (for account UI). */
  currentPeriodEnd: string | null;
  /** Set when subscribed so account UI can route cancel/manage flows. */
  subscriptionBillingProvider?: "stripe" | "app_store" | null;
};

export type PaywallPayload = {
  code: "PAYWALL_REQUIRED";
  remainingFreeCritiques: number;
  checkoutRequired: boolean;
  message?: string;
};
