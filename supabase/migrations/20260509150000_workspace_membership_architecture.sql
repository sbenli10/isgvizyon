-- Multi-workspace membership architecture.
-- Keeps existing RPC names used by the app, while adding member based access,
-- OSGB seat limits, personal workspace switching and invite/request safeguards.

alter table public.profiles
  add column if not exists active_workspace_id uuid references public.organizations(id) on delete set null;

alter table public.organizations
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists is_active boolean not null default true;

update public.organizations o
set owner_id = p.id
from public.profiles p
where o.owner_id is null
  and p.organization_id = o.id
  and lower(coalesce(p.role, '')) = 'admin';

create unique index if not exists idx_organizations_one_owned_workspace_per_user
  on public.organizations(owner_id)
  where owner_id is not null;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_status_check check (status in ('active', 'inactive')),
  constraint organization_members_role_check check (role in ('owner', 'admin', 'operations_manager', 'finance', 'secretary', 'inspector', 'staff', 'member'))
);

alter table public.organization_members
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_organization_members_org_user
  on public.organization_members(organization_id, user_id);

create index if not exists idx_organization_members_user_status
  on public.organization_members(user_id, status);

create index if not exists idx_organization_members_org_status
  on public.organization_members(organization_id, status);

alter table public.organization_members enable row level security;

insert into public.organization_members (organization_id, user_id, role, status)
select distinct
  p.organization_id,
  p.id,
  case
    when o.owner_id = p.id then 'owner'
    when lower(coalesce(p.role, '')) = 'admin' then 'admin'
    else coalesce(nullif(lower(p.role), ''), 'staff')
  end,
  'active'
from public.profiles p
left join public.organizations o on o.id = p.organization_id
where p.organization_id is not null
on conflict (organization_id, user_id) do update
set
  role = case
    when excluded.role = 'owner' then 'owner'
    else public.organization_members.role
  end,
  status = 'active',
  updated_at = now();

alter table public.organization_invites
  add column if not exists used_by uuid references auth.users(id) on delete set null,
  add column if not exists used_at timestamptz;

create or replace view public.organization_invitations as
select
  id,
  organization_id,
  code,
  (not is_active or used_count >= max_uses) as is_used,
  expires_at,
  created_by,
  used_by,
  created_at,
  updated_at
from public.organization_invites;

create or replace view public.join_requests as
select
  id,
  organization_id,
  requester_id as user_id,
  status,
  message,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
from public.organization_join_requests;

create or replace function public.get_active_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.active_workspace_id, p.organization_id)
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.get_active_workspace_id()
$$;

create or replace function public.is_active_workspace_member(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.organization_members om
      on om.organization_id = _organization_id
     and om.user_id = p.id
     and om.status = 'active'
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and coalesce(p.active_workspace_id, p.organization_id) = _organization_id
  )
$$;

create or replace function public.is_organization_member(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_workspace_member(_organization_id)
$$;

create or replace function public.is_organization_admin(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.organization_members om
      on om.organization_id = _organization_id
     and om.user_id = p.id
     and om.status = 'active'
    where p.id = auth.uid()
      and coalesce(p.active_workspace_id, p.organization_id) = _organization_id
      and (
        om.role in ('owner', 'admin')
        or lower(coalesce(p.role, '')) = 'admin'
      )
  )
$$;

create or replace function public.is_osgb_org_member(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_workspace_member(_organization_id)
$$;

create or replace function public.is_osgb_org_role(_organization_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.organization_members om
      on om.organization_id = _organization_id
     and om.user_id = p.id
     and om.status = 'active'
    where p.id = auth.uid()
      and coalesce(p.active_workspace_id, p.organization_id) = _organization_id
      and lower(coalesce(om.role, '')) = any (select lower(value) from unnest(_roles) as value)
  )
$$;

create or replace function public.get_org_effective_plan(_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with org_subscription as (
    select
      os.plan_code,
      os.status,
      os.trial_ends_at,
      os.current_period_end
    from public.organization_subscriptions os
    where os.org_id = _organization_id
    order by os.updated_at desc nulls last, os.created_at desc nulls last
    limit 1
  ),
  owner_profile as (
    select
      coalesce(p.plan_type::text, p.subscription_plan, 'free') as plan_code,
      p.subscription_status,
      p.trial_ends_at
    from public.organizations o
    join public.profiles p on p.id = o.owner_id
    where o.id = _organization_id
    limit 1
  )
  select case
    when exists (
      select 1
      from org_subscription os
      where os.plan_code = 'osgb'
        and os.status in ('active', 'trialing')
        and (os.status <> 'trialing' or os.trial_ends_at is null or os.trial_ends_at > now())
        and (os.current_period_end is null or os.current_period_end > now() - interval '1 day')
    ) then 'osgb'
    when exists (
      select 1
      from owner_profile op
      where op.plan_code = 'osgb'
        and op.subscription_status in ('active', 'trial')
        and (op.subscription_status <> 'trial' or op.trial_ends_at is null or op.trial_ends_at > now())
    ) then 'osgb'
    when exists (
      select 1
      from org_subscription os
      where os.plan_code = 'premium'
        and os.status in ('active', 'trialing')
    ) then 'premium'
    else 'free'
  end
$$;

create or replace function public.get_org_external_member_limit(_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.get_org_effective_plan(_organization_id) = 'osgb' then 3 else 0 end
$$;

create or replace function public.enforce_organization_member_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_limit integer;
  v_current_count integer;
begin
  if coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

  select owner_id into v_owner_id
  from public.organizations
  where id = new.organization_id;

  if new.user_id = v_owner_id or new.role = 'owner' then
    return new;
  end if;

  v_limit := public.get_org_external_member_limit(new.organization_id);

  select count(*)
  into v_current_count
  from public.organization_members om
  where om.organization_id = new.organization_id
    and om.status = 'active'
    and om.user_id <> coalesce(v_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (tg_op = 'INSERT' or om.id <> new.id);

  if v_current_count >= v_limit then
    raise exception 'Bu organizasyonun ekip koltuk limiti dolu. Ekip daveti icin OSGB paketi ve bos koltuk gerekir.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_organization_member_seat_limit on public.organization_members;
create trigger trg_enforce_organization_member_seat_limit
before insert or update of status, role, organization_id, user_id
on public.organization_members
for each row
execute function public.enforce_organization_member_seat_limit();

create or replace function public.set_profile_workspace(
  p_user_id uuid,
  p_organization_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger record;
begin
  for v_trigger in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.profiles'::regclass
      and p.proname = 'protect_profile_sensitive_fields'
      and not t.tgisinternal
  loop
    execute format('alter table public.profiles disable trigger %I', v_trigger.tgname);
  end loop;

  begin
    update public.profiles
    set
      organization_id = p_organization_id,
      active_workspace_id = p_organization_id,
      role = coalesce(nullif(trim(p_role), ''), role, 'staff'),
      updated_at = now()
    where id = p_user_id;

    for v_trigger in
      select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.profiles'::regclass
        and p.proname = 'protect_profile_sensitive_fields'
        and not t.tgisinternal
    loop
      execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
    end loop;
  exception
    when others then
      for v_trigger in
        select t.tgname
        from pg_trigger t
        join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = 'public.profiles'::regclass
          and p.proname = 'protect_profile_sensitive_fields'
          and not t.tgisinternal
      loop
        execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
      end loop;

      raise;
  end;
end;
$$;

create or replace function public.create_workspace_organization(
  p_name text,
  p_industry text default null,
  p_city text default null,
  p_phone text default null,
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_owned_org uuid;
  v_slug_base text;
  v_slug text;
  v_suffix integer := 0;
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organizasyon adi zorunludur';
  end if;

  select id
  into v_existing_owned_org
  from public.organizations
  where owner_id = v_user_id
  limit 1;

  if v_existing_owned_org is not null then
    perform public.set_profile_workspace(v_user_id, v_existing_owned_org, 'admin');

    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_existing_owned_org, v_user_id, 'owner', 'active')
    on conflict (organization_id, user_id) do update
    set role = 'owner', status = 'active', updated_at = now();

    return v_existing_owned_org;
  end if;

  v_slug_base := public.slugify_text(p_name);
  if coalesce(v_slug_base, '') = '' then
    v_slug_base := 'organizasyon';
  end if;

  loop
    v_slug := case when v_suffix = 0 then v_slug_base else v_slug_base || '-' || v_suffix::text end;
    exit when not exists (select 1 from public.organizations where slug = v_slug);
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.organizations (
    name,
    slug,
    industry,
    city,
    phone,
    website,
    country,
    owner_id,
    is_active
  )
  values (
    trim(p_name),
    v_slug,
    nullif(trim(p_industry), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_website), ''),
    'Turkiye',
    v_user_id,
    true
  )
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

  insert into public.organization_subscriptions (org_id, plan_code, status)
  values (v_org_id, 'free', 'active')
  on conflict (org_id) do update
  set plan_code = coalesce(public.organization_subscriptions.plan_code, 'free'),
      status = coalesce(public.organization_subscriptions.status, 'active'),
      updated_at = now();

  perform public.set_profile_workspace(v_user_id, v_org_id, 'admin');

  return v_org_id;
end;
$$;

create or replace function public.create_organization_invite(
  p_expires_in_days integer default 7,
  p_max_uses integer default 1,
  p_note text default null
)
returns table (
  invite_id uuid,
  organization_id uuid,
  organization_name text,
  code text,
  expires_at timestamptz,
  max_uses integer,
  used_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_org_name text;
  v_code text;
  v_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  v_org_id := public.get_active_workspace_id();

  if v_org_id is null or not public.is_organization_admin(v_org_id) then
    raise exception 'Bu islem yalnizca organizasyon yoneticileri icindir';
  end if;

  if public.get_org_effective_plan(v_org_id) <> 'osgb' then
    raise exception 'Ekip daveti icin OSGB plani veya aktif OSGB demo gerekir';
  end if;

  v_remaining := public.get_org_external_member_limit(v_org_id) - (
    select count(*)
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = v_org_id
      and om.status = 'active'
      and om.user_id <> o.owner_id
  );

  if v_remaining <= 0 then
    raise exception 'Ekip koltuk limiti dolu';
  end if;

  select name into v_org_name from public.organizations where id = v_org_id;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_user_id::text), 1, 10));
  v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);

  insert into public.organization_invites (
    organization_id,
    code,
    created_by,
    note,
    max_uses,
    expires_at
  )
  values (
    v_org_id,
    v_code,
    v_user_id,
    nullif(trim(p_note), ''),
    least(greatest(coalesce(p_max_uses, 1), 1), v_remaining),
    case
      when p_expires_in_days is null or p_expires_in_days <= 0 then null
      else now() + make_interval(days => p_expires_in_days)
    end
  )
  returning
    id,
    organization_invites.organization_id,
    v_org_name,
    organization_invites.code,
    organization_invites.expires_at,
    organization_invites.max_uses,
    organization_invites.used_count
  into invite_id, organization_id, organization_name, code, expires_at, max_uses, used_count;

  return next;
end;
$$;

create or replace function public.redeem_organization_invite(p_code text)
returns table (
  organization_id uuid,
  organization_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if coalesce(trim(p_code), '') = '' then
    raise exception 'Davet kodu zorunludur';
  end if;

  select *
  into v_invite
  from public.organization_invites
  where upper(code) = upper(trim(p_code))
    and is_active = true
    and (expires_at is null or expires_at > now())
    and used_count < max_uses
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Davet kodu gecersiz veya suresi dolmus';
  end if;

  if public.get_org_effective_plan(v_invite.organization_id) <> 'osgb' then
    raise exception 'Bu organizasyona davet ile katilim icin OSGB plani aktif olmalidir';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invite.organization_id, v_user_id, 'staff', 'active')
  on conflict (organization_id, user_id) do update
  set status = 'active',
      role = case when public.organization_members.role = 'owner' then 'owner' else 'staff' end,
      updated_at = now();

  perform public.set_profile_workspace(v_user_id, v_invite.organization_id, 'staff');

  update public.organization_invites
  set used_count = used_count + 1,
      is_active = case when used_count + 1 >= max_uses then false else is_active end,
      used_by = v_user_id,
      used_at = now(),
      updated_at = now()
  where id = v_invite.id;

  update public.organization_join_requests
  set status = 'cancelled',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now()
  where requester_id = v_user_id
    and status = 'pending';

  return query
  select o.id, o.name
  from public.organizations o
  where o.id = v_invite.organization_id;
end;
$$;

create or replace function public.search_joinable_organizations(p_query text default null)
returns table (
  organization_id uuid,
  name text,
  industry text,
  city text,
  slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as organization_id,
    o.name,
    o.industry,
    o.city,
    o.slug
  from public.organizations o
  where coalesce(o.is_active, true) = true
    and (
      coalesce(trim(p_query), '') = ''
      or o.name ilike '%' || trim(p_query) || '%'
      or o.slug ilike '%' || trim(p_query) || '%'
    )
    and not exists (
      select 1
      from public.organization_members om
      where om.organization_id = o.id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  order by o.created_at desc nulls last, o.name asc
  limit 12
$$;

create or replace function public.submit_organization_join_request(
  p_organization_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if p_organization_id is null then
    raise exception 'Organizasyon secimi zorunludur';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id and coalesce(is_active, true) = true) then
    raise exception 'Organizasyon bulunamadi';
  end if;

  if exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = v_user_id
      and status = 'active'
  ) then
    raise exception 'Bu organizasyona zaten uyesiniz';
  end if;

  if exists (
    select 1
    from public.organization_join_requests
    where requester_id = v_user_id
      and organization_id = p_organization_id
      and status = 'pending'
  ) then
    raise exception 'Bu organizasyon icin zaten bekleyen bir isteginiz var';
  end if;

  insert into public.organization_join_requests (organization_id, requester_id, message)
  values (p_organization_id, v_user_id, nullif(trim(p_message), ''))
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.review_organization_join_request(
  p_request_id uuid,
  p_decision text
)
returns table (
  request_id uuid,
  status text,
  organization_id uuid,
  requester_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_request public.organization_join_requests%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'Karar yalnizca approved veya rejected olabilir';
  end if;

  v_org_id := public.get_active_workspace_id();

  if v_org_id is null or not public.is_organization_admin(v_org_id) then
    raise exception 'Bu islem yalnizca organizasyon yoneticileri icindir';
  end if;

  select *
  into v_request
  from public.organization_join_requests
  where id = p_request_id
  limit 1;

  if not found then
    raise exception 'Katilim istegi bulunamadi';
  end if;

  if v_request.organization_id <> v_org_id then
    raise exception 'Bu istegi yonetme yetkiniz yok';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Bu istek zaten islenmis';
  end if;

  if v_decision = 'approved' then
    if public.get_org_effective_plan(v_org_id) <> 'osgb' then
      raise exception 'Katilim istegi onayi icin OSGB plani veya aktif OSGB demo gerekir';
    end if;

    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_request.organization_id, v_request.requester_id, 'staff', 'active')
    on conflict (organization_id, user_id) do update
    set status = 'active',
        role = case when public.organization_members.role = 'owner' then 'owner' else 'staff' end,
        updated_at = now();

    perform public.set_profile_workspace(v_request.requester_id, v_request.organization_id, 'staff');

    update public.organization_join_requests
    set status = 'cancelled',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        updated_at = now()
    where requester_id = v_request.requester_id
      and status = 'pending'
      and id <> v_request.id;
  end if;

  update public.organization_join_requests
  set status = v_decision,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = v_request.id;

  return query
  select r.id, r.status, r.organization_id, r.requester_id
  from public.organization_join_requests r
  where r.id = v_request.id;
end;
$$;

create or replace function public.list_my_workspaces()
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_type text,
  role text,
  is_active boolean,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    null::uuid as workspace_id,
    'Kisisel Hesabim'::text as workspace_name,
    'personal'::text as workspace_type,
    'owner'::text as role,
    true as is_active,
    public.get_active_workspace_id() is null as is_current
  union all
  select
    o.id as workspace_id,
    o.name as workspace_name,
    case when o.owner_id = auth.uid() then 'owned_organization' else 'joined_organization' end as workspace_type,
    om.role,
    om.status = 'active' as is_active,
    public.get_active_workspace_id() = o.id as is_current
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.status = 'active'
    and coalesce(o.is_active, true) = true
  order by workspace_type desc, workspace_name asc
$$;

create or replace function public.switch_workspace(p_organization_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_role text;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if p_organization_id is null then
    perform public.set_profile_workspace(v_user_id, null, 'staff');

    return null;
  end if;

  select role
  into v_member_role
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = v_user_id
    and status = 'active'
  limit 1;

  if not found then
    raise exception 'Bu calisma alanina erisim yetkiniz yok';
  end if;

  perform public.set_profile_workspace(
    v_user_id,
    p_organization_id,
    case when v_member_role in ('owner', 'admin') then 'admin' else 'staff' end
  );

  return p_organization_id;
end;
$$;

create or replace function public.leave_current_organization()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  v_org_id := public.get_active_workspace_id();

  if v_org_id is null then
    raise exception 'Aktif organizasyon bulunamadi';
  end if;

  select owner_id into v_owner_id
  from public.organizations
  where id = v_org_id;

  if v_owner_id = v_user_id then
    raise exception 'Organizasyon sahibi kendi kurdugu organizasyondan ayrilamaz. Once organizasyonu devredin veya kapatin.';
  end if;

  delete from public.organization_members
  where organization_id = v_org_id
    and user_id = v_user_id;

  perform public.set_profile_workspace(v_user_id, null, 'staff');

  return v_org_id;
end;
$$;

create or replace function public.remove_organization_member(p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_member public.organization_members%rowtype;
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  v_org_id := public.get_active_workspace_id();

  if v_org_id is null or not public.is_organization_admin(v_org_id) then
    raise exception 'Bu islem yalnizca organizasyon yoneticileri icindir';
  end if;

  select *
  into v_member
  from public.organization_members
  where id = p_member_id
    and organization_id = v_org_id
  limit 1;

  if not found then
    raise exception 'Uye bulunamadi';
  end if;

  select owner_id into v_owner_id
  from public.organizations
  where id = v_org_id;

  if v_member.user_id = v_owner_id or v_member.role = 'owner' then
    raise exception 'Organizasyon sahibi ekipten cikarilamaz';
  end if;

  delete from public.organization_members
  where id = p_member_id;

  if exists (
    select 1
    from public.profiles
    where id = v_member.user_id
      and coalesce(active_workspace_id, organization_id) = v_org_id
  ) then
    perform public.set_profile_workspace(v_member.user_id, null, 'staff');
  end if;

  return p_member_id;
end;
$$;

create or replace function public.list_organization_members()
returns table (
  member_id uuid,
  organization_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role text,
  status text,
  created_at timestamptz,
  is_owner boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    om.id as member_id,
    om.organization_id,
    om.user_id,
    p.full_name,
    p.email,
    om.role,
    om.status,
    om.created_at,
    o.owner_id = om.user_id as is_owner
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  left join public.profiles p on p.id = om.user_id
  where om.organization_id = public.get_active_workspace_id()
    and public.is_organization_admin(om.organization_id)
  order by is_owner desc, om.created_at asc
$$;

drop policy if exists "Organization members can view memberships" on public.organization_members;
create policy "Organization members can view memberships"
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_organization_admin(organization_id)
);

drop policy if exists "Organization admins can manage memberships" on public.organization_members;
create policy "Organization admins can manage memberships"
on public.organization_members
for all
to authenticated
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));

grant select on public.organization_invitations to authenticated;
grant select on public.join_requests to authenticated;
grant execute on function public.get_active_workspace_id() to authenticated;
grant execute on function public.is_active_workspace_member(uuid) to authenticated;
grant execute on function public.get_org_effective_plan(uuid) to authenticated;
grant execute on function public.get_org_external_member_limit(uuid) to authenticated;
grant execute on function public.list_my_workspaces() to authenticated;
grant execute on function public.switch_workspace(uuid) to authenticated;
grant execute on function public.leave_current_organization() to authenticated;
grant execute on function public.remove_organization_member(uuid) to authenticated;
grant execute on function public.list_organization_members() to authenticated;

