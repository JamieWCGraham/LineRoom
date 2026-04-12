alter table public.subscriptions
add column if not exists email text;

create index if not exists subscriptions_email_idx
on public.subscriptions (email);
