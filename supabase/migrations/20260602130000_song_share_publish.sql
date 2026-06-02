-- Public share links: snapshot title + draft lyrics on songs (no anon RLS on songs).
-- Idempotent: safe to re-run if columns were created on a previous partial apply.

alter table public.songs add column if not exists share_token text;
alter table public.songs add column if not exists published_at timestamptz;
alter table public.songs add column if not exists published_title text;
alter table public.songs add column if not exists published_draft_text text;
alter table public.songs add column if not exists published_from_version_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.songs'::regclass
      and conname = 'songs_share_token_key'
  ) then
    alter table public.songs
      add constraint songs_share_token_key unique (share_token);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.songs'::regclass
      and conname = 'songs_published_from_version_id_fkey'
  ) then
    alter table public.songs
      add constraint songs_published_from_version_id_fkey
      foreign key (published_from_version_id)
      references public.song_versions (id)
      on delete set null;
  end if;
end
$$;

create index if not exists songs_share_token_idx
  on public.songs (share_token)
  where share_token is not null;

create or replace function public.get_published_lyrics(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 64 then
    return null;
  end if;

  select
    s.published_title,
    s.published_draft_text,
    s.published_at
  into rec
  from public.songs s
  where s.share_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'title', rec.published_title,
    'draft_text', coalesce(rec.published_draft_text, ''),
    'published_at', rec.published_at
  );
end;
$$;

grant execute on function public.get_published_lyrics(text) to anon;
grant execute on function public.get_published_lyrics(text) to authenticated;
