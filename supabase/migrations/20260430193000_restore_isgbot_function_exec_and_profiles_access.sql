do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_manage_isgkatip_company'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    grant execute on function public.can_manage_isgkatip_company(uuid) to authenticated;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owns_company'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    grant execute on function public.owns_company(uuid) to authenticated;
  end if;
end
$$;

grant select, insert, update on table public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
