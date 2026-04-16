-- Optional persistence for multi-node critique engine observability (off unless CRITIQUE_ENGINE_RUNS_ENABLED=1).

create table if not exists public.critique_engine_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  session_id text not null,
  success boolean not null,
  error text,
  request jsonb not null,
  node_outputs jsonb,
  final_output jsonb,
  model_configs jsonb not null default '{}'::jsonb,
  timings jsonb not null default '{}'::jsonb,
  prompt_versions jsonb not null default '{}'::jsonb
);

create index if not exists critique_engine_runs_user_created_idx
  on public.critique_engine_runs (user_id, created_at desc);

alter table public.critique_engine_runs enable row level security;

create policy "Users read own critique_engine_runs"
  on public.critique_engine_runs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts use service role from the API after verifying the user matches `user_id`.

grant select on public.critique_engine_runs to authenticated;
