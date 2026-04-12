alter table public.organizations enable row level security;

create or replace function public.is_organization_member(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and organization_id = _organization_id
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'Organization members can view organizations'
  ) then
    create policy "Organization members can view organizations"
      on public.organizations
      for select
      to authenticated
      using (public.is_organization_member(id));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'Organization members can update organizations'
  ) then
    create policy "Organization members can update organizations"
      on public.organizations
      for update
      to authenticated
      using (public.is_organization_member(id))
      with check (public.is_organization_member(id));
  end if;
end
$$;

create or replace function public.bootstrap_signup_organization(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_org_name text,
  p_org_slug text,
  p_country text default 'Türkiye'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'Organization name is required';
  end if;

  if coalesce(trim(p_org_slug), '') = '' then
    raise exception 'Organization slug is required';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'Auth user not found for signup bootstrap';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_user_id
      and organization_id is not null
  ) then
    raise exception 'Profile is already linked to an organization';
  end if;

  insert into public.organizations (name, slug, country)
  values (trim(p_org_name), trim(p_org_slug), coalesce(nullif(trim(p_country), ''), 'Türkiye'))
  returning id into v_org_id;

  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    is_active
  )
  values (
    p_user_id,
    v_org_id,
    nullif(trim(p_full_name), ''),
    nullif(trim(p_email), ''),
    'admin',
    true
  )
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      role = coalesce(public.profiles.role, excluded.role),
      is_active = coalesce(public.profiles.is_active, excluded.is_active),
      updated_at = now();

  return v_org_id;
end;
$$;

grant execute on function public.bootstrap_signup_organization(uuid, text, text, text, text, text) to anon;
grant execute on function public.bootstrap_signup_organization(uuid, text, text, text, text, text) to authenticated;
