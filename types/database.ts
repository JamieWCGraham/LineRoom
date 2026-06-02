export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpsert = {
  id: string;
  email: string;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  updated_at?: string;
};

export type SongRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  share_token?: string | null;
  published_at?: string | null;
  published_title?: string | null;
  published_draft_text?: string | null;
  published_from_version_id?: string | null;
};

export type SongVersionRow = {
  id: string;
  song_id: string;
  version_number: number;
  draft_text: string;
  brainstorm_text: string;
  chat_messages: unknown;
  critique: unknown;
  meta: unknown;
  created_at: string;
  /** Increments on each successful server persist for this version row (optimistic concurrency). */
  save_sub_revision?: number;
};

/** Stripe subscription statuses we persist in the `subscriptions` table. */
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid"
  | "paused";

export type BillingProvider = "stripe" | "app_store";

export type SubscriptionRow = {
  user_id: string;
  email: string | null;
  /** Where the current entitlement is sourced from (defaults to stripe in DB). */
  billing_provider?: BillingProvider;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  app_store_original_transaction_id?: string | null;
  app_store_product_id?: string | null;
  status: SubscriptionStatus | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type CritiqueUsageRow = {
  user_id: string;
  successful_critiques_used: number;
  created_at: string;
  updated_at: string;
};

export type StripeWebhookEventRow = {
  stripe_event_id: string;
  event_type: string;
  processed_at: string;
};
