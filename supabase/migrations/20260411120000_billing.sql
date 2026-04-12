-- Billing: Stripe subscription sync + free critique quota counter

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);
create index subscriptions_stripe_subscription_id_idx on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create table public.critique_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  successful_critiques_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.critique_usage enable row level security;

create policy "Users can read own critique usage"
on public.critique_usage
for select
to authenticated
using (auth.uid() = user_id);

-- Reserve one free-tier slot before calling the model (prevents parallel quota bypass).
-- Call release_free_critique_slot() on any failure after a successful reserve.
create or replace function public.reserve_free_critique_slot(p_quota integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_used integer;
begin
  if uid is null then
    return false;
  end if;

  if p_quota < 1 then
    return false;
  end if;

  insert into public.critique_usage (user_id, successful_critiques_used)
  values (uid, 0)
  on conflict (user_id) do nothing;

  select cu.successful_critiques_used
  into current_used
  from public.critique_usage cu
  where cu.user_id = uid
  for update;

  if current_used >= p_quota then
    return false;
  end if;

  update public.critique_usage
  set
    successful_critiques_used = successful_critiques_used + 1,
    updated_at = now()
  where user_id = uid;

  return true;
end;
$$;

create or replace function public.release_free_critique_slot()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  update public.critique_usage
  set
    successful_critiques_used = greatest(0, successful_critiques_used - 1),
    updated_at = now()
  where user_id = uid;
end;
$$;

revoke all on function public.reserve_free_critique_slot(integer) from public;
grant execute on function public.reserve_free_critique_slot(integer) to authenticated;

revoke all on function public.release_free_critique_slot() from public;
grant execute on function public.release_free_critique_slot() to authenticated;

-- Idempotent webhook processing (service role bypasses RLS)
create table public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
