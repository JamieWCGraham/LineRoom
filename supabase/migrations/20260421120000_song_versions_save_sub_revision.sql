alter table public.song_versions
  add column if not exists save_sub_revision bigint not null default 0;

create or replace function public.apply_song_version_state_update(
  p_song_id uuid,
  p_version_id uuid,
  p_expected_sub_revision bigint,
  p_draft_text text,
  p_brainstorm_text text,
  p_chat_messages jsonb,
  p_critique jsonb,
  p_meta jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_rev bigint;
  current_rev bigint;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  update public.song_versions sv
  set
    draft_text = p_draft_text,
    brainstorm_text = p_brainstorm_text,
    chat_messages = p_chat_messages,
    critique = p_critique,
    meta = p_meta,
    save_sub_revision = sv.save_sub_revision + 1
  where sv.id = p_version_id
    and sv.song_id = p_song_id
    and sv.save_sub_revision = p_expected_sub_revision
    and exists (
      select 1
      from public.songs s
      where s.id = p_song_id
        and s.user_id = auth.uid()
    )
  returning sv.save_sub_revision into new_rev;

  if new_rev is not null then
    update public.songs
    set updated_at = now()
    where id = p_song_id;

    return jsonb_build_object('ok', true, 'newSubRevision', new_rev);
  end if;

  select sv.save_sub_revision into current_rev
  from public.song_versions sv
  inner join public.songs s on s.id = sv.song_id
  where sv.id = p_version_id
    and sv.song_id = p_song_id
    and s.user_id = auth.uid();

  if current_rev is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok',
    false,
    'reason',
    'stale',
    'currentSubRevision',
    current_rev
  );
end;
$$;

grant execute on function public.apply_song_version_state_update(
  uuid,
  uuid,
  bigint,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) to authenticated;
