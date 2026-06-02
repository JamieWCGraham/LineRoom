-- Latest two versions per song for dashboard (rating, momentum, search preview).
create or replace function public.get_dashboard_recent_versions(p_song_ids uuid[])
returns table (
  song_id uuid,
  version_number int,
  critique jsonb,
  meta jsonb,
  draft_text text
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    ranked.song_id,
    ranked.version_number,
    ranked.critique,
    ranked.meta,
    ranked.draft_text
  from (
    select
      sv.song_id,
      sv.version_number,
      sv.critique,
      sv.meta,
      sv.draft_text,
      row_number() over (
        partition by sv.song_id
        order by sv.version_number desc
      ) as rn
    from public.song_versions sv
    inner join public.songs s on s.id = sv.song_id
    where sv.song_id = any (p_song_ids)
      and s.user_id = auth.uid()
  ) ranked
  where ranked.rn <= 2;
$$;

grant execute on function public.get_dashboard_recent_versions(uuid[]) to authenticated;
