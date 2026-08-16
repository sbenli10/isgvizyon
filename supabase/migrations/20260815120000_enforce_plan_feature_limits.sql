-- Centralize package limits around subscription_plans, plan_features and feature_usage.
-- The migration is defensive: triggers are installed only when the target table exists.

create or replace function public.check_feature_access_for_org(
  p_org_id uuid,
  p_feature_key text
)
returns table (
  org_id uuid,
  plan_code text,
  feature_key text,
  is_enabled boolean,
  limit_value integer,
  period text,
  current_usage integer,
  current_value bigint,
  allowed boolean,
  reason text
)
language sql
security definer
set search_path = public
as $$
  with subscription_row as (
    select
      os.org_id,
      os.plan_code
    from public.organization_subscriptions os
    where os.org_id = p_org_id
      and os.status in ('active', 'trialing', 'past_due')
    order by
      case os.status when 'active' then 0 when 'trialing' then 1 else 2 end,
      os.created_at desc
    limit 1
  ),
  feature_row as (
    select
      sr.org_id,
      sr.plan_code,
      pf.feature_key,
      pf.is_enabled,
      pf.limit_value,
      pf.period,
      coalesce(fu.usage_count, 0)::integer as current_usage,
      coalesce(fu.usage_value, 0)::bigint as current_value
    from subscription_row sr
    join public.plan_features pf
      on pf.plan_code = sr.plan_code
     and pf.feature_key = p_feature_key
    left join public.feature_usage fu
      on fu.org_id = sr.org_id
     and fu.feature_key = pf.feature_key
     and fu.period_key is not distinct from public.get_current_period_key(pf.period)
    limit 1
  )
  select
    fr.org_id,
    fr.plan_code,
    coalesce(fr.feature_key, p_feature_key) as feature_key,
    coalesce(fr.is_enabled, false) as is_enabled,
    fr.limit_value,
    fr.period,
    coalesce(fr.current_usage, 0) as current_usage,
    coalesce(fr.current_value, 0) as current_value,
    case
      when fr.feature_key is null then false
      when fr.is_enabled = false then false
      when fr.limit_value is null then true
      when fr.current_usage < fr.limit_value then true
      else false
    end as allowed,
    case
      when fr.feature_key is null then 'feature_not_found'
      when fr.is_enabled = false then 'disabled'
      when fr.limit_value is null then 'allowed'
      when fr.current_usage < fr.limit_value then 'allowed'
      else 'limit_reached'
    end as reason
  from feature_row fr
  union all
  select
    p_org_id,
    null::text,
    p_feature_key,
    false,
    null::integer,
    null::text,
    0,
    0::bigint,
    false,
    'feature_not_found'
  where not exists (select 1 from feature_row)
$$;

create or replace function public.increment_feature_usage_for_org(
  p_org_id uuid,
  p_feature_key text,
  p_by_count integer default 1,
  p_by_value bigint default 0
)
returns table (
  out_org_id uuid,
  out_feature_key text,
  out_period_key text,
  out_usage_count integer,
  out_usage_value bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_period_key text;
begin
  if p_org_id is null then
    raise exception 'Organization not found for feature limit check';
  end if;

  if coalesce(trim(p_feature_key), '') = '' then
    raise exception 'Feature key is required';
  end if;

  select *
  into v_access
  from public.check_feature_access_for_org(p_org_id, p_feature_key)
  limit 1;

  if coalesce(v_access.allowed, false) = false then
    raise exception 'Feature limit denied for %: %', p_feature_key, coalesce(v_access.reason, 'not_allowed');
  end if;

  if v_access.limit_value is not null
     and (coalesce(v_access.current_usage, 0) + greatest(coalesce(p_by_count, 1), 0)) > v_access.limit_value then
    raise exception 'Feature limit exceeded for %', p_feature_key;
  end if;

  v_period_key := public.get_current_period_key(v_access.period);

  insert into public.feature_usage (
    org_id,
    feature_key,
    period_key,
    usage_count,
    usage_value
  )
  values (
    p_org_id,
    p_feature_key,
    v_period_key,
    greatest(coalesce(p_by_count, 1), 0),
    greatest(coalesce(p_by_value, 0), 0)
  )
  on conflict (org_id, feature_key, period_key)
  do update
    set usage_count = public.feature_usage.usage_count + greatest(excluded.usage_count, 0),
        usage_value = public.feature_usage.usage_value + greatest(excluded.usage_value, 0),
        updated_at = now();

  return query
  select
    fu.org_id,
    fu.feature_key,
    fu.period_key,
    fu.usage_count,
    fu.usage_value
  from public.feature_usage fu
  where fu.org_id = p_org_id
    and fu.feature_key = p_feature_key
    and fu.period_key is not distinct from v_period_key
  limit 1;
end;
$$;

create or replace function public.resolve_feature_limit_org_id(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_company_id uuid;
  v_user_id uuid;
begin
  if p_payload ? 'org_id' and nullif(p_payload->>'org_id', '') is not null then
    return (p_payload->>'org_id')::uuid;
  end if;

  if p_payload ? 'organization_id' and nullif(p_payload->>'organization_id', '') is not null then
    return (p_payload->>'organization_id')::uuid;
  end if;

  if p_payload ? 'company_id' and nullif(p_payload->>'company_id', '') is not null then
    v_company_id := (p_payload->>'company_id')::uuid;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'companies'
        and column_name = 'org_id'
    ) then
      execute 'select org_id from public.companies where id = $1'
      into v_org_id
      using v_company_id;
    end if;

    if v_org_id is null then
      select p.organization_id
      into v_org_id
      from public.companies c
      join public.profiles p on p.id = c.user_id
      where c.id = v_company_id
      limit 1;
    end if;

    if v_org_id is not null then
      return v_org_id;
    end if;
  end if;

  if p_payload ? 'user_id' and nullif(p_payload->>'user_id', '') is not null then
    v_user_id := (p_payload->>'user_id')::uuid;
    select p.organization_id
    into v_org_id
    from public.profiles p
    where p.id = v_user_id
    limit 1;

    if v_org_id is not null then
      return v_org_id;
    end if;
  end if;

  return public.get_my_organization_id();
end;
$$;

create or replace function public.enforce_plan_limit_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feature_key text := tg_argv[0];
  v_org_id uuid;
begin
  v_org_id := public.resolve_feature_limit_org_id(to_jsonb(new));

  if v_org_id is not null then
    perform *
    from public.increment_feature_usage_for_org(v_org_id, v_feature_key, 1, 0);
  end if;

  return new;
end;
$$;

create or replace function public.install_plan_limit_insert_trigger(
  p_table_name text,
  p_feature_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger_name text := format('trg_plan_limit_%s', replace(p_feature_key, '.', '_'));
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  execute format('drop trigger if exists %I on public.%I', v_trigger_name, p_table_name);
  execute format(
    'create trigger %I before insert on public.%I for each row execute function public.enforce_plan_limit_on_insert(%L)',
    v_trigger_name,
    p_table_name,
    p_feature_key
  );
end;
$$;

select public.install_plan_limit_insert_trigger('companies', 'companies.count');
select public.install_plan_limit_insert_trigger('employees', 'employees.count');
select public.install_plan_limit_insert_trigger('risk_assessments', 'risk_assessments.count');
select public.install_plan_limit_insert_trigger('inspections', 'inspections.count_monthly');
select public.install_plan_limit_insert_trigger('capa_records', 'capa.count');
select public.install_plan_limit_insert_trigger('adep_plans', 'adep.count');
select public.install_plan_limit_insert_trigger('annual_plans', 'annual_plans.count');
select public.install_plan_limit_insert_trigger('board_meetings', 'board_meetings.count');
select public.install_plan_limit_insert_trigger('periodic_controls', 'periodic_controls.count');
select public.install_plan_limit_insert_trigger('ppe_zimmet_records', 'ppe.count');
select public.install_plan_limit_insert_trigger('ppe_assignments', 'ppe.count');
select public.install_plan_limit_insert_trigger('health_surveillance_records', 'health_surveillance.count');
select public.install_plan_limit_insert_trigger('assignment_letters', 'assignment_letters.count');
select public.install_plan_limit_insert_trigger('certificate_jobs', 'certificates.monthly');
select public.install_plan_limit_insert_trigger('certificates', 'certificates.monthly');
select public.install_plan_limit_insert_trigger('reports', 'reports.export_monthly');

create or replace function public.count_plan_feature_records_for_org(
  p_org_id uuid,
  p_table_name text,
  p_monthly boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_has_org_id boolean;
  v_has_company_id boolean;
  v_has_user_id boolean;
  v_has_created_at boolean;
  v_where_time text := '';
begin
  if p_org_id is null or to_regclass(format('public.%I', p_table_name)) is null then
    return 0;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table_name and column_name = 'org_id'
  ) into v_has_org_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table_name and column_name = 'company_id'
  ) into v_has_company_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table_name and column_name = 'user_id'
  ) into v_has_user_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table_name and column_name = 'created_at'
  ) into v_has_created_at;

  if p_monthly and v_has_created_at then
    v_where_time := ' and coalesce(t.created_at, now()) >= date_trunc(''month'', timezone(''UTC'', now())) and coalesce(t.created_at, now()) < date_trunc(''month'', timezone(''UTC'', now())) + interval ''1 month''';
  end if;

  if v_has_org_id then
    execute format('select count(*) from public.%I t where t.org_id = $1%s', p_table_name, v_where_time)
    into v_count
    using p_org_id;
    return coalesce(v_count, 0);
  end if;

  if v_has_company_id then
    execute format(
      'select count(*) from public.%I t join public.companies c on c.id = t.company_id join public.profiles p on p.id = c.user_id where p.organization_id = $1%s',
      p_table_name,
      v_where_time
    )
    into v_count
    using p_org_id;
    return coalesce(v_count, 0);
  end if;

  if v_has_user_id then
    execute format(
      'select count(*) from public.%I t join public.profiles p on p.id = t.user_id where p.organization_id = $1%s',
      p_table_name,
      v_where_time
    )
    into v_count
    using p_org_id;
    return coalesce(v_count, 0);
  end if;

  return 0;
end;
$$;

create or replace function public.backfill_my_feature_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_month_key text;
  v_counts jsonb;
  v_lifetime_features text[] := array[
    'companies.count',
    'employees.count',
    'risk_assessments.count',
    'capa.count',
    'adep.count',
    'annual_plans.count',
    'board_meetings.count',
    'periodic_controls.count',
    'ppe.count',
    'health_surveillance.count',
    'assignment_letters.count'
  ];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_organization_id();

  if v_org_id is null then
    raise exception 'Organization not found for current user';
  end if;

  if not public.is_organization_admin(v_org_id) then
    raise exception 'Only organization admins can backfill feature usage';
  end if;

  v_month_key := public.get_current_period_key('monthly');

  v_counts := jsonb_build_object(
    'companies.count', public.count_plan_feature_records_for_org(v_org_id, 'companies', false),
    'employees.count', public.count_plan_feature_records_for_org(v_org_id, 'employees', false),
    'risk_assessments.count', public.count_plan_feature_records_for_org(v_org_id, 'risk_assessments', false),
    'inspections.count_monthly', public.count_plan_feature_records_for_org(v_org_id, 'inspections', true),
    'capa.count', public.count_plan_feature_records_for_org(v_org_id, 'capa_records', false),
    'adep.count', public.count_plan_feature_records_for_org(v_org_id, 'adep_plans', false),
    'annual_plans.count', public.count_plan_feature_records_for_org(v_org_id, 'annual_plans', false),
    'board_meetings.count', public.count_plan_feature_records_for_org(v_org_id, 'board_meetings', false),
    'periodic_controls.count', public.count_plan_feature_records_for_org(v_org_id, 'periodic_controls', false),
    'ppe.count',
      greatest(
        public.count_plan_feature_records_for_org(v_org_id, 'ppe_zimmet_records', false),
        public.count_plan_feature_records_for_org(v_org_id, 'ppe_assignments', false)
      ),
    'health_surveillance.count', public.count_plan_feature_records_for_org(v_org_id, 'health_surveillance_records', false),
    'assignment_letters.count', public.count_plan_feature_records_for_org(v_org_id, 'assignment_letters', false),
    'certificates.monthly',
      greatest(
        public.count_plan_feature_records_for_org(v_org_id, 'certificate_jobs', true),
        public.count_plan_feature_records_for_org(v_org_id, 'certificates', true)
      ),
    'reports.export_monthly', public.count_plan_feature_records_for_org(v_org_id, 'reports', true)
  );

  delete from public.feature_usage
  where org_id = v_org_id
    and (
      (feature_key = any(v_lifetime_features) and period_key = 'lifetime')
      or (feature_key in ('inspections.count_monthly', 'certificates.monthly', 'reports.export_monthly') and period_key = v_month_key)
    );

  insert into public.feature_usage (org_id, feature_key, period_key, usage_count, usage_value)
  values
    (v_org_id, 'companies.count', 'lifetime', (v_counts->>'companies.count')::integer, 0),
    (v_org_id, 'employees.count', 'lifetime', (v_counts->>'employees.count')::integer, 0),
    (v_org_id, 'risk_assessments.count', 'lifetime', (v_counts->>'risk_assessments.count')::integer, 0),
    (v_org_id, 'capa.count', 'lifetime', (v_counts->>'capa.count')::integer, 0),
    (v_org_id, 'adep.count', 'lifetime', (v_counts->>'adep.count')::integer, 0),
    (v_org_id, 'annual_plans.count', 'lifetime', (v_counts->>'annual_plans.count')::integer, 0),
    (v_org_id, 'board_meetings.count', 'lifetime', (v_counts->>'board_meetings.count')::integer, 0),
    (v_org_id, 'periodic_controls.count', 'lifetime', (v_counts->>'periodic_controls.count')::integer, 0),
    (v_org_id, 'ppe.count', 'lifetime', (v_counts->>'ppe.count')::integer, 0),
    (v_org_id, 'health_surveillance.count', 'lifetime', (v_counts->>'health_surveillance.count')::integer, 0),
    (v_org_id, 'assignment_letters.count', 'lifetime', (v_counts->>'assignment_letters.count')::integer, 0),
    (v_org_id, 'inspections.count_monthly', v_month_key, (v_counts->>'inspections.count_monthly')::integer, 0),
    (v_org_id, 'certificates.monthly', v_month_key, (v_counts->>'certificates.monthly')::integer, 0),
    (v_org_id, 'reports.export_monthly', v_month_key, (v_counts->>'reports.export_monthly')::integer, 0)
  on conflict (org_id, feature_key, period_key)
  do update
    set usage_count = excluded.usage_count,
        usage_value = excluded.usage_value,
        updated_at = now();

  return jsonb_build_object(
    'organizationId', v_org_id,
    'counts', v_counts
  );
end;
$$;

create or replace function public.get_platform_admin_plan_features()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_platform_admin() then
      jsonb_build_object('error', 'Not authorized')
    else
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'plan_code', pf.plan_code,
            'feature_key', pf.feature_key,
            'limit_value', pf.limit_value,
            'is_enabled', pf.is_enabled,
            'period', pf.period
          )
          order by
            case pf.plan_code when 'free' then 0 when 'premium' then 1 when 'osgb' then 2 else 10 end,
            pf.feature_key
        ),
        '[]'::jsonb
      )
  end
  from public.plan_features pf
  where pf.plan_code in ('free', 'premium', 'osgb')
$$;

create or replace function public.update_platform_admin_plan_features(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_plan_code text;
  v_feature_key text;
  v_period text;
  v_limit integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_plan_code := lower(trim(coalesce(v_row->>'plan_code', '')));
    v_feature_key := trim(coalesce(v_row->>'feature_key', ''));
    v_period := nullif(lower(trim(coalesce(v_row->>'period', ''))), '');
    v_limit := case
      when v_row ? 'limit_value' and nullif(v_row->>'limit_value', '') is not null then (v_row->>'limit_value')::integer
      else null
    end;

    if v_plan_code not in ('free', 'premium', 'osgb') then
      raise exception 'Unsupported plan code: %', v_plan_code;
    end if;

    if v_feature_key = '' then
      raise exception 'Feature key is required';
    end if;

    if v_period is not null and v_period not in ('monthly', 'lifetime') then
      raise exception 'Unsupported period: %', v_period;
    end if;

    insert into public.plan_features (plan_code, feature_key, limit_value, is_enabled, period)
    values (
      v_plan_code,
      v_feature_key,
      v_limit,
      coalesce((v_row->>'is_enabled')::boolean, true),
      v_period
    )
    on conflict (plan_code, feature_key)
    do update
      set limit_value = excluded.limit_value,
          is_enabled = excluded.is_enabled,
          period = excluded.period,
          updated_at = now();
  end loop;

  return public.get_platform_admin_plan_features();
end;
$$;

grant execute on function public.check_feature_access_for_org(uuid, text) to service_role;
grant execute on function public.increment_feature_usage_for_org(uuid, text, integer, bigint) to service_role;
grant execute on function public.resolve_feature_limit_org_id(jsonb) to authenticated, service_role;
grant execute on function public.get_platform_admin_plan_features() to authenticated;
grant execute on function public.update_platform_admin_plan_features(jsonb) to authenticated;
