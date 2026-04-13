alter table public.song_versions
  add column if not exists brainstorm_text text not null default '';
