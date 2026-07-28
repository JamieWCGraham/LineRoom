-- Ensure profiles are removed when auth users are deleted.

delete from public.profiles p
where not exists (
  select 1 from auth.users u where u.id = p.id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end
$$;
