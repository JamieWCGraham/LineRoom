-- Cached LLM summaries for GitHub commits (evals /commits UI). Server-only via service role.

create table public.github_commit_summaries (
  id uuid primary key default gen_random_uuid(),
  repository text not null,
  commit_sha text not null,
  summary text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create unique index github_commit_summaries_repository_sha_key
  on public.github_commit_summaries (repository, commit_sha);

create index github_commit_summaries_repository_idx
  on public.github_commit_summaries (repository);

alter table public.github_commit_summaries enable row level security;
