create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled song',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index songs_user_id_idx on public.songs (user_id);
create index songs_user_id_updated_at_idx on public.songs (user_id, updated_at desc);

create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  version_number int not null,
  draft_text text not null default '',
  chat_messages jsonb not null default '[]'::jsonb,
  critique jsonb,
  meta jsonb not null default '{"title":"","similarArtists":"","genre":""}'::jsonb,
  created_at timestamptz not null default now(),
  unique (song_id, version_number)
);

create index song_versions_song_id_idx on public.song_versions (song_id);
create index song_versions_song_id_version_number_idx
  on public.song_versions (song_id, version_number desc);

alter table public.songs enable row level security;
alter table public.song_versions enable row level security;

create policy "Users can view own songs"
on public.songs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own songs"
on public.songs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own songs"
on public.songs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own songs"
on public.songs
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view versions of own songs"
on public.song_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.songs s
    where s.id = song_versions.song_id
      and s.user_id = auth.uid()
  )
);

create policy "Users can insert versions for own songs"
on public.song_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.songs s
    where s.id = song_versions.song_id
      and s.user_id = auth.uid()
  )
);

create policy "Users can update versions of own songs"
on public.song_versions
for update
to authenticated
using (
  exists (
    select 1
    from public.songs s
    where s.id = song_versions.song_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.songs s
    where s.id = song_versions.song_id
      and s.user_id = auth.uid()
  )
);

create policy "Users can delete versions of own songs"
on public.song_versions
for delete
to authenticated
using (
  exists (
    select 1
    from public.songs s
    where s.id = song_versions.song_id
      and s.user_id = auth.uid()
  )
);
