create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  note text,
  is_active boolean not null default true,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invites_max_uses_check check (max_uses > 0),
  constraint organization_invites_used_count_check check (used_count >= 0)
);

create table if not exists public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_join_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create index if not exists idx_organization_invites_org_id on public.organization_invites(organization_id);
create index if not exists idx_organization_invites_code on public.organization_invites(code);
create index if not exists idx_organization_invites_active on public.organization_invites(organization_id, is_active, expires_at);
create index if not exists idx_organization_join_requests_org_id on public.organization_join_requests(organization_id, status, created_at desc);
create index if not exists idx_organization_join_requests_requester_id on public.organization_join_requests(requester_id, status, created_at desc);

alter table public.organization_invites enable row level security;
alter table public.organization_join_requests enable row level security;

create or replace function public.slugify_text(p_input text)
returns text
language sql
immutable
as $$
  select trim(
    both '-'
    from regexp_replace(
      lower(
        translate(
          coalesce(p_input, ''),
          'ÇĞİÖŞÜçğıöşü',
          'CGIOSUcgiosu'
        )
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  )
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
  v_profile public.profiles%rowtype;
  v_slug_base text;
  v_slug text;
  v_suffix integer := 0;
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organizasyon adı zorunludur';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found then
    raise exception 'Profil bulunamadı';
  end if;

  if v_profile.organization_id is not null then
    raise exception 'Zaten bir organizasyona bağlısınız';
  end if;

  v_slug_base := public.slugify_text(p_name);
  if coalesce(v_slug_base, '') = '' then
    v_slug_base := 'organizasyon';
  end if;

  loop
    v_slug := case when v_suffix = 0 then v_slug_base else v_slug_base || '-' || v_suffix::text end;
    exit when not exists (
      select 1
      from public.organizations
      where slug = v_slug
    );
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.organizations (
    name,
    slug,
    industry,
    city,
    phone,
    website,
    country
  )
  values (
    trim(p_name),
    v_slug,
    nullif(trim(p_industry), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_website), ''),
    'Türkiye'
  )
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id,
      role = 'admin',
      updated_at = now()
  where id = v_user_id;

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
  v_profile public.profiles%rowtype;
  v_org_name text;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found or v_profile.organization_id is null then
    raise exception 'Önce bir organizasyona bağlı olmalısınız';
  end if;

  if lower(coalesce(v_profile.role, '')) <> 'admin' then
    raise exception 'Bu işlem yalnızca organizasyon yöneticileri içindir';
  end if;

  select name
  into v_org_name
  from public.organizations
  where id = v_profile.organization_id;

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
    v_profile.organization_id,
    v_code,
    v_user_id,
    nullif(trim(p_note), ''),
    greatest(coalesce(p_max_uses, 1), 1),
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

create or replace function public.list_my_organization_invites()
returns table (
  invite_id uuid,
  organization_id uuid,
  organization_name text,
  code text,
  note text,
  is_active boolean,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oi.id as invite_id,
    oi.organization_id,
    o.name as organization_name,
    oi.code,
    oi.note,
    oi.is_active,
    oi.max_uses,
    oi.used_count,
    oi.expires_at,
    oi.created_at
  from public.organization_invites oi
  join public.organizations o on o.id = oi.organization_id
  join public.profiles p on p.organization_id = oi.organization_id
  where p.id = auth.uid()
    and lower(coalesce(p.role, '')) = 'admin'
  order by oi.created_at desc
  limit 10
$$;

create or replace function public.deactivate_organization_invite(
  p_invite_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_invite public.organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadÄ±';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found or v_profile.organization_id is null or lower(coalesce(v_profile.role, '')) <> 'admin' then
    raise exception 'Bu iÅŸlem yalnÄ±zca organizasyon yÃ¶neticileri iÃ§indir';
  end if;

  select *
  into v_invite
  from public.organization_invites
  where id = p_invite_id
  limit 1;

  if not found then
    raise exception 'Davet kodu bulunamadÄ±';
  end if;

  if v_invite.organization_id <> v_profile.organization_id then
    raise exception 'Bu davet kodunu yÃ¶netme yetkiniz yok';
  end if;

  update public.organization_invites
  set is_active = false,
      updated_at = now()
  where id = p_invite_id;

  return p_invite_id;
end;
$$;

create or replace function public.regenerate_organization_invite(
  p_invite_id uuid,
  p_expires_in_days integer default 7,
  p_max_uses integer default 1
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
  v_profile public.profiles%rowtype;
  v_invite public.organization_invites%rowtype;
  v_org_name text;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadÄ±';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found or v_profile.organization_id is null or lower(coalesce(v_profile.role, '')) <> 'admin' then
    raise exception 'Bu iÅŸlem yalnÄ±zca organizasyon yÃ¶neticileri iÃ§indir';
  end if;

  select *
  into v_invite
  from public.organization_invites
  where id = p_invite_id
  limit 1;

  if not found then
    raise exception 'Davet kodu bulunamadÄ±';
  end if;

  if v_invite.organization_id <> v_profile.organization_id then
    raise exception 'Bu davet kodunu yÃ¶netme yetkiniz yok';
  end if;

  update public.organization_invites
  set is_active = false,
      updated_at = now()
  where id = v_invite.id;

  select name
  into v_org_name
  from public.organizations
  where id = v_profile.organization_id;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_user_id::text || p_invite_id::text), 1, 10));
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
    v_profile.organization_id,
    v_code,
    v_user_id,
    coalesce(v_invite.note, 'Yeniden oluşturulan davet kodu'),
    greatest(coalesce(p_max_uses, v_invite.max_uses, 1), 1),
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

create or replace function public.redeem_organization_invite(
  p_code text
)
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
  v_profile public.profiles%rowtype;
  v_invite public.organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;

  if coalesce(trim(p_code), '') = '' then
    raise exception 'Davet kodu zorunludur';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found then
    raise exception 'Profil bulunamadı';
  end if;

  if v_profile.organization_id is not null then
    raise exception 'Zaten bir organizasyona bağlısınız';
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
    raise exception 'Davet kodu geçersiz veya süresi dolmuş';
  end if;

  update public.profiles
  set organization_id = v_invite.organization_id,
      role = case
        when lower(coalesce(role, '')) in ('admin', 'inspector', 'staff') then role
        else 'staff'
      end,
      updated_at = now()
  where id = v_user_id;

  update public.organization_invites
  set used_count = used_count + 1,
      is_active = case when used_count + 1 >= max_uses then false else is_active end,
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

create or replace function public.search_joinable_organizations(
  p_query text default null
)
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
  where coalesce(trim(p_query), '') = ''
     or o.name ilike '%' || trim(p_query) || '%'
     or o.slug ilike '%' || trim(p_query) || '%'
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
  v_profile public.profiles%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;

  if p_organization_id is null then
    raise exception 'Organizasyon seçimi zorunludur';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found then
    raise exception 'Profil bulunamadı';
  end if;

  if v_profile.organization_id is not null then
    raise exception 'Zaten bir organizasyona bağlısınız';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_organization_id
  ) then
    raise exception 'Organizasyon bulunamadı';
  end if;

  if exists (
    select 1
    from public.organization_join_requests
    where requester_id = v_user_id
      and organization_id = p_organization_id
      and status = 'pending'
  ) then
    raise exception 'Bu organizasyon için zaten bekleyen bir isteğiniz var';
  end if;

  insert into public.organization_join_requests (
    organization_id,
    requester_id,
    message
  )
  values (
    p_organization_id,
    v_user_id,
    nullif(trim(p_message), '')
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.list_my_join_requests()
returns table (
  request_id uuid,
  organization_id uuid,
  organization_name text,
  city text,
  industry text,
  status text,
  message text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as request_id,
    r.organization_id,
    o.name as organization_name,
    o.city,
    o.industry,
    r.status,
    r.message,
    r.reviewed_at,
    r.created_at
  from public.organization_join_requests r
  join public.organizations o on o.id = r.organization_id
  where r.requester_id = auth.uid()
  order by r.created_at desc
  limit 20
$$;

create or replace function public.list_organization_join_requests()
returns table (
  request_id uuid,
  organization_id uuid,
  requester_id uuid,
  requester_name text,
  requester_email text,
  requester_position text,
  status text,
  message text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as request_id,
    r.organization_id,
    r.requester_id,
    p.full_name as requester_name,
    p.email as requester_email,
    p.position as requester_position,
    r.status,
    r.message,
    r.created_at
  from public.organization_join_requests r
  join public.profiles admin_profile on admin_profile.organization_id = r.organization_id
  left join public.profiles p on p.id = r.requester_id
  where admin_profile.id = auth.uid()
    and lower(coalesce(admin_profile.role, '')) = 'admin'
    and r.status = 'pending'
  order by r.created_at asc
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
  v_admin_profile public.profiles%rowtype;
  v_request public.organization_join_requests%rowtype;
  v_target_profile public.profiles%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'Karar yalnızca approved veya rejected olabilir';
  end if;

  select *
  into v_admin_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found or v_admin_profile.organization_id is null or lower(coalesce(v_admin_profile.role, '')) <> 'admin' then
    raise exception 'Bu işlem yalnızca organizasyon yöneticileri içindir';
  end if;

  select *
  into v_request
  from public.organization_join_requests
  where id = p_request_id
  limit 1;

  if not found then
    raise exception 'Katılım isteği bulunamadı';
  end if;

  if v_request.organization_id <> v_admin_profile.organization_id then
    raise exception 'Bu isteği yönetme yetkiniz yok';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Bu istek zaten işlenmiş';
  end if;

  if v_decision = 'approved' then
    select *
    into v_target_profile
    from public.profiles
    where id = v_request.requester_id
    limit 1;

    if not found then
      raise exception 'İstek sahibinin profili bulunamadı';
    end if;

    if v_target_profile.organization_id is not null then
      raise exception 'Kullanıcı zaten başka bir organizasyona bağlı';
    end if;

    update public.profiles
    set organization_id = v_request.organization_id,
        role = case
          when lower(coalesce(role, '')) in ('admin', 'inspector', 'staff') then role
          else 'staff'
        end,
        updated_at = now()
    where id = v_request.requester_id;

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

grant execute on function public.create_workspace_organization(text, text, text, text, text) to authenticated;
grant execute on function public.create_organization_invite(integer, integer, text) to authenticated;
grant execute on function public.list_my_organization_invites() to authenticated;
grant execute on function public.deactivate_organization_invite(uuid) to authenticated;
grant execute on function public.regenerate_organization_invite(uuid, integer, integer) to authenticated;
grant execute on function public.redeem_organization_invite(text) to authenticated;
grant execute on function public.search_joinable_organizations(text) to authenticated;
grant execute on function public.submit_organization_join_request(uuid, text) to authenticated;
grant execute on function public.list_my_join_requests() to authenticated;
grant execute on function public.list_organization_join_requests() to authenticated;
grant execute on function public.review_organization_join_request(uuid, text) to authenticated;
