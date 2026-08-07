create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_platform_admin, false) = true
      and coalesce(p.is_active, true) = true
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.platform_runtime_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_runtime_settings enable row level security;

drop policy if exists "Platform admins can manage runtime settings" on public.platform_runtime_settings;
create policy "Platform admins can manage runtime settings"
on public.platform_runtime_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Anyone can read public runtime settings" on public.platform_runtime_settings;
create policy "Anyone can read public runtime settings"
on public.platform_runtime_settings
for select
to anon, authenticated
using (setting_key in ('osgb_demo'));

create table if not exists public.platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_admin_audit_logs enable row level security;

drop policy if exists "Platform admins can read admin audit logs" on public.platform_admin_audit_logs;
create policy "Platform admins can read admin audit logs"
on public.platform_admin_audit_logs
for select
to authenticated
using (public.is_platform_admin());

drop policy if exists "Platform admins can insert admin audit logs" on public.platform_admin_audit_logs;
create policy "Platform admins can insert admin audit logs"
on public.platform_admin_audit_logs
for insert
to authenticated
with check (public.is_platform_admin());

insert into public.platform_runtime_settings (setting_key, setting_value, description)
values (
  'platform_admin_security',
  jsonb_build_object(
    'guard_enabled', false,
    'guard_hash', null,
    'guard_configured', false,
    'session_ttl_minutes', 45,
    'maintenance_mode', false,
    'registration_enabled', true,
    'job_moderation_required', true,
    'readonly_mode', false,
    'support_email', '',
    'platform_notice', '',
    'notice_enabled', false
  ),
  'Platform sahibi paneli güvenlik, sistem ve görünürlük ayarları.'
)
on conflict (setting_key) do nothing;

create or replace function public.log_platform_admin_action(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select email into v_email
  from public.profiles
  where id = auth.uid();

  insert into public.platform_admin_audit_logs (
    admin_user_id,
    admin_email,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    v_email,
    nullif(trim(p_action), ''),
    nullif(trim(coalesce(p_target_type, '')), ''),
    nullif(trim(coalesce(p_target_id, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.get_platform_admin_security_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_safe_settings jsonb;
  v_logs jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select setting_value
  into v_settings
  from public.platform_runtime_settings
  where setting_key = 'platform_admin_security';

  v_settings := coalesce(v_settings, '{}'::jsonb);
  v_safe_settings := (v_settings - 'guard_hash') || jsonb_build_object(
    'guard_configured',
    coalesce(nullif(v_settings->>'guard_hash', ''), '') <> ''
  );

  select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.created_at desc), '[]'::jsonb)
  into v_logs
  from (
    select
      id,
      admin_user_id,
      admin_email,
      action,
      target_type,
      target_id,
      metadata,
      created_at
    from public.platform_admin_audit_logs
    order by created_at desc
    limit 120
  ) row_item;

  return jsonb_build_object(
    'settings', v_safe_settings,
    'auditLogs', v_logs
  );
end;
$$;

create or replace function public.verify_platform_admin_guard(p_guard_phrase text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_hash text;
  v_expected_hash text;
  v_enabled boolean;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select setting_value
  into v_settings
  from public.platform_runtime_settings
  where setting_key = 'platform_admin_security';

  v_settings := coalesce(v_settings, '{}'::jsonb);
  v_enabled := coalesce((v_settings->>'guard_enabled')::boolean, false);
  v_expected_hash := nullif(v_settings->>'guard_hash', '');

  if not v_enabled then
    perform public.log_platform_admin_action('admin_guard_bypassed_disabled', 'platform_admin_security', null, '{}'::jsonb);
    return jsonb_build_object('verified', true, 'guard_enabled', false);
  end if;

  if v_expected_hash is null then
    perform public.log_platform_admin_action('admin_guard_missing_hash', 'platform_admin_security', null, '{}'::jsonb);
    return jsonb_build_object('verified', false, 'reason', 'guard_not_configured');
  end if;

  v_hash := encode(digest(coalesce(p_guard_phrase, ''), 'sha256'), 'hex');

  if v_hash = v_expected_hash then
    perform public.log_platform_admin_action('admin_guard_verified', 'platform_admin_security', null, '{}'::jsonb);
    return jsonb_build_object('verified', true, 'guard_enabled', true);
  end if;

  perform public.log_platform_admin_action('admin_guard_failed', 'platform_admin_security', null, jsonb_build_object('reason', 'wrong_guard_phrase'));
  return jsonb_build_object('verified', false, 'reason', 'wrong_guard_phrase');
end;
$$;

create or replace function public.update_platform_admin_security_settings(
  p_settings jsonb,
  p_new_guard_phrase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current jsonb;
  v_next jsonb;
  v_ttl integer;
  v_new_guard text := nullif(trim(coalesce(p_new_guard_phrase, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select setting_value
  into v_current
  from public.platform_runtime_settings
  where setting_key = 'platform_admin_security';

  v_current := coalesce(v_current, '{}'::jsonb);
  v_ttl := greatest(10, least(480, coalesce((p_settings->>'session_ttl_minutes')::integer, 45)));

  v_next := v_current || jsonb_build_object(
    'guard_enabled', coalesce((p_settings->>'guard_enabled')::boolean, false),
    'session_ttl_minutes', v_ttl,
    'maintenance_mode', coalesce((p_settings->>'maintenance_mode')::boolean, false),
    'registration_enabled', coalesce((p_settings->>'registration_enabled')::boolean, true),
    'job_moderation_required', coalesce((p_settings->>'job_moderation_required')::boolean, true),
    'readonly_mode', coalesce((p_settings->>'readonly_mode')::boolean, false),
    'support_email', left(coalesce(p_settings->>'support_email', ''), 180),
    'platform_notice', left(coalesce(p_settings->>'platform_notice', ''), 500),
    'notice_enabled', coalesce((p_settings->>'notice_enabled')::boolean, false)
  );

  if v_new_guard is not null then
    v_next := v_next || jsonb_build_object(
      'guard_hash',
      encode(digest(v_new_guard, 'sha256'), 'hex'),
      'guard_configured',
      true
    );
  else
    v_next := v_next || jsonb_build_object(
      'guard_configured',
      coalesce(nullif(v_next->>'guard_hash', ''), '') <> ''
    );
  end if;

  if coalesce((v_next->>'guard_enabled')::boolean, false)
     and coalesce(nullif(v_next->>'guard_hash', ''), '') = '' then
    raise exception 'Gizli yönetim anahtarı etkinleştirilmeden önce anahtar belirlenmelidir.';
  end if;

  insert into public.platform_runtime_settings (setting_key, setting_value, description, updated_by)
  values (
    'platform_admin_security',
    v_next,
    'Platform sahibi paneli güvenlik, sistem ve görünürlük ayarları.',
    auth.uid()
  )
  on conflict (setting_key) do update
  set
    setting_value = excluded.setting_value,
    description = excluded.description,
    updated_at = now(),
    updated_by = auth.uid();

  perform public.log_platform_admin_action(
    'platform_admin_security_updated',
    'platform_runtime_settings',
    'platform_admin_security',
    (v_next - 'guard_hash')
  );

  return (v_next - 'guard_hash') || jsonb_build_object(
    'guard_configured',
    coalesce(nullif(v_next->>'guard_hash', ''), '') <> ''
  );
end;
$$;

grant execute on function public.log_platform_admin_action(text, text, text, jsonb) to authenticated;
grant execute on function public.get_platform_admin_security_state() to authenticated;
grant execute on function public.verify_platform_admin_guard(text) to authenticated;
grant execute on function public.update_platform_admin_security_settings(jsonb, text) to authenticated;
