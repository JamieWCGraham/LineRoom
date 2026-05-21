-- Global registry: identical lyric drafts (modulo whitespace) share canonical critique scores.

create table public.lyric_draft_critique_registry (
  draft_fingerprint text primary key,
  overall_rating_band text not null,
  subscores jsonb not null,
  source_song_version_id uuid references public.song_versions (id) on delete set null,
  first_critiqued_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now(),
  hit_count bigint not null default 0
);

create index lyric_draft_registry_last_hit_idx
  on public.lyric_draft_critique_registry (last_hit_at desc);

alter table public.lyric_draft_critique_registry enable row level security;

-- Hot path: lookup by fingerprint; bump hit counter when found.
create or replace function public.resolve_lyric_draft_critique_registry(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if p_fingerprint is null or length(p_fingerprint) <> 64 then
    return null;
  end if;

  update public.lyric_draft_critique_registry r
  set
    last_hit_at = now(),
    hit_count = r.hit_count + 1
  where r.draft_fingerprint = p_fingerprint
  returning r.overall_rating_band, r.subscores into rec;

  if found then
    return jsonb_build_object(
      'overall_rating_band', rec.overall_rating_band,
      'subscores', rec.subscores
    );
  end if;

  return null;
end;
$$;

-- Cold path: first successful critique for this fingerprint wins (on conflict do nothing).
create or replace function public.register_lyric_draft_critique_registry(
  p_fingerprint text,
  p_overall_rating_band text,
  p_subscores jsonb,
  p_source_song_version_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_fingerprint is null or length(p_fingerprint) <> 64 then
    return;
  end if;

  insert into public.lyric_draft_critique_registry (
    draft_fingerprint,
    overall_rating_band,
    subscores,
    source_song_version_id
  ) values (
    p_fingerprint,
    p_overall_rating_band,
    p_subscores,
    p_source_song_version_id
  )
  on conflict (draft_fingerprint) do nothing;
end;
$$;

grant execute on function public.resolve_lyric_draft_critique_registry(text) to authenticated;
grant execute on function public.register_lyric_draft_critique_registry(text, text, jsonb, uuid) to authenticated;
