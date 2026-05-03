-- iOS IAP: provider + App Store identifiers on subscriptions (single row per user)
alter table public.subscriptions
  add column if not exists billing_provider text not null default 'stripe';

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_provider_check;

alter table public.subscriptions
  add constraint subscriptions_billing_provider_check
  check (billing_provider in ('stripe', 'app_store'));

alter table public.subscriptions
  add column if not exists app_store_original_transaction_id text;

alter table public.subscriptions
  add column if not exists app_store_product_id text;

create unique index if not exists subscriptions_app_store_original_txn_idx
  on public.subscriptions (app_store_original_transaction_id)
  where app_store_original_transaction_id is not null;

-- Idempotent App Store Server Notifications v2 processing
create table if not exists public.app_store_notification_events (
  notification_uuid text primary key,
  notification_type text,
  processed_at timestamptz not null default now()
);

alter table public.app_store_notification_events enable row level security;
-- No policies: JWT roles cannot access; service role bypasses RLS for writes.
