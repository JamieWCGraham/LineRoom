create or replace function public.create_song_with_initial_version()
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_song_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.songs (user_id, title)
  values (auth.uid(), 'Untitled piece')
  returning id into new_song_id;

  insert into public.song_versions (
    song_id,
    version_number,
    draft_text,
    chat_messages,
    critique,
    meta
  )
  values (
    new_song_id,
    1,
    '',
    '[]'::jsonb,
    null,
    '{"title":"","similarArtists":"","genre":""}'::jsonb
  );

  return new_song_id;
end;
$$;
