do $$
begin
  create type public.subscription_plan_type as enum ('free', 'premium', 'osgb');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists plan_type public.subscription_plan_type not null default 'free';

do $$
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
    set plan_type = case
      when lower(coalesce(subscription_plan, 'free')) = 'osgb' then 'osgb'::public.subscription_plan_type
      when lower(coalesce(subscription_plan, 'free')) = 'premium' then 'premium'::public.subscription_plan_type
      else 'free'::public.subscription_plan_type
    end
    where plan_type is distinct from case
      when lower(coalesce(subscription_plan, 'free')) = 'osgb' then 'osgb'::public.subscription_plan_type
      when lower(coalesce(subscription_plan, 'free')) = 'premium' then 'premium'::public.subscription_plan_type
      else 'free'::public.subscription_plan_type
    end;

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
end $$;

create or replace function public.check_user_feature_limit(p_user_id uuid, p_feature_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_effective_plan public.subscription_plan_type := 'free';
  v_feature_key text := lower(trim(coalesce(p_feature_name, '')));
  v_limit integer;
  v_usage integer := 0;
  v_period_key text := to_char(now(), 'YYYY-MM');
begin
  select
    p.id,
    p.organization_id,
    p.plan_type,
    p.subscription_plan,
    p.subscription_status,
    p.trial_ends_at
  into v_profile
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return false;
  end if;

  v_effective_plan := coalesce(
    v_profile.plan_type,
    case
      when lower(coalesce(v_profile.subscription_plan, 'free')) = 'osgb' then 'osgb'::public.subscription_plan_type
      when lower(coalesce(v_profile.subscription_plan, 'free')) = 'premium' then 'premium'::public.subscription_plan_type
      else 'free'::public.subscription_plan_type
    end
  );

  if lower(coalesce(v_profile.subscription_status, 'free')) = 'trial'
     and v_profile.trial_ends_at is not null
     and v_profile.trial_ends_at > now() then
    v_effective_plan := 'osgb';
  end if;

  if lower(coalesce(v_profile.subscription_status, 'free')) = 'trial'
     and (v_profile.trial_ends_at is null or v_profile.trial_ends_at <= now()) then
    v_effective_plan := 'free';
  end if;

  if v_profile.organization_id is not null and exists (
    select 1
    from public.organization_subscriptions os
    where os.org_id = v_profile.organization_id
      and os.status = 'trialing'
      and os.trial_ends_at is not null
      and os.trial_ends_at > now()
  ) then
    v_effective_plan := 'osgb';
  end if;

  if v_effective_plan = 'osgb' then
    return true;
  end if;

  if v_effective_plan = 'premium' then
    return v_feature_key not in ('osgb_module', 'osgb', 'osgb.access');
  end if;

  if v_feature_key in ('isg_bot', 'isgbot', 'isg_bot.access', 'osgb_module', 'osgb', 'osgb.access') then
    return false;
  end if;

  v_limit := case v_feature_key
    when 'risk_assessment' then 3
    when 'risk_assessments' then 3
    when 'risk_assessments.count' then 3
    when 'inspection' then 5
    when 'inspections' then 5
    when 'inspections.count_monthly' then 5
    when 'capa' then 10
    when 'capa.count' then 10
    when 'reports' then 3
    when 'reports.export_monthly' then 3
    when 'assignment_letters' then 10
    when 'assignment_letters.count' then 10
    when 'adep' then 1
    when 'adep.count' then 1
    else null
  end;

  if v_limit is null then
    return true;
  end if;

  if v_profile.organization_id is not null then
    select coalesce(sum(fu.usage_count), 0)::integer
    into v_usage
    from public.feature_usage fu
    where fu.org_id = v_profile.organization_id
      and fu.feature_key = v_feature_key
      and fu.period_key = v_period_key;
  end if;

  return v_usage < v_limit;
end;
$$;

grant execute on function public.check_user_feature_limit(uuid, text) to authenticated;

create or replace function public.start_my_personal_premium_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_trial_ends_at timestamptz := now() + interval '7 days';
  v_trigger record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profil kaydi bulunamadi.';
  end if;

  if v_profile.organization_id is not null then
    raise exception 'Kisisel demo yalnizca organizasyonsuz kullanicilar icindir.';
  end if;

  if lower(coalesce(v_profile.subscription_status, 'free')) in ('trial', 'active', 'premium') then
    raise exception 'Aktif bir uyeliginiz veya denemeniz zaten bulunuyor.';
  end if;

  if v_profile.subscription_started_at is not null or v_profile.trial_ends_at is not null then
    raise exception '7 gunluk demo hakkinizi daha once kullandiniz.';
  end if;

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
      plan_type = 'osgb',
      subscription_plan = 'osgb',
      subscription_status = 'trial',
      subscription_started_at = now(),
      trial_ends_at = v_trial_ends_at,
      updated_at = now()
    where id = v_user_id;

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

  return jsonb_build_object(
    'mode', 'personal',
    'planCode', 'osgb',
    'status', 'trial',
    'trialEndsAt', v_trial_ends_at,
    'daysLeftInTrial', greatest(0, ceil(extract(epoch from (v_trial_ends_at - now())) / 86400.0)::integer)
  );
end;
$$;

grant execute on function public.start_my_personal_premium_trial() to authenticated;

create or replace function public.start_my_premium_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_is_admin boolean;
  v_trial_ends_at timestamptz;
  v_existing_trial timestamptz;
  v_trigger record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_organization_id();

  if v_org_id is null then
    raise exception 'Organization not found for current user';
  end if;

  v_is_admin := public.is_organization_admin(v_org_id);

  if not coalesce(v_is_admin, false) then
    raise exception 'Only organization admins can start a trial';
  end if;

  select trial_ends_at
  into v_existing_trial
  from public.organization_subscriptions
  where org_id = v_org_id
  limit 1;

  if v_existing_trial is not null then
    raise exception 'Demo suresi bu organizasyon icin zaten kullanilmis';
  end if;

  v_trial_ends_at := now() + interval '7 days';

  insert into public.organization_subscriptions (
    org_id,
    plan_code,
    status,
    starts_at,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    updated_at
  )
  values (
    v_org_id,
    'osgb',
    'trialing',
    now(),
    now(),
    v_trial_ends_at,
    now(),
    v_trial_ends_at,
    false,
    now()
  )
  on conflict (org_id)
  do update
    set plan_code = 'osgb',
        status = 'trialing',
        starts_at = now(),
        trial_started_at = now(),
        trial_ends_at = v_trial_ends_at,
        current_period_start = now(),
        current_period_end = v_trial_ends_at,
        cancel_at_period_end = false,
        canceled_at = null,
        updated_at = now();

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
      plan_type = 'osgb',
      subscription_plan = 'osgb',
      subscription_status = 'trial',
      subscription_started_at = coalesce(subscription_started_at, now()),
      trial_ends_at = v_trial_ends_at,
      updated_at = now()
    where organization_id = v_org_id;

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

  insert into public.billing_history (
    user_id,
    organization_id,
    plan_name,
    amount,
    currency,
    status,
    billing_date,
    period_start,
    period_end,
    payment_method,
    provider,
    provider_reference,
    metadata
  )
  values (
    v_user_id,
    v_org_id,
    'OSGB Trial',
    0,
    'TRY',
    'paid',
    now(),
    now(),
    v_trial_ends_at,
    'Trial',
    'internal',
    'trial',
    jsonb_build_object('source', 'start_my_premium_trial', 'trial_plan', 'osgb')
  );

  return public.get_my_billing_overview();
end;
$$;

grant execute on function public.start_my_premium_trial() to authenticated;

create or replace function public.expire_personal_trial_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affected integer := 0;
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
      plan_type = 'free',
      subscription_plan = 'free',
      subscription_status = 'free',
      updated_at = now()
    where lower(coalesce(subscription_status, 'free')) = 'trial'
      and trial_ends_at is not null
      and trial_ends_at <= now();

    get diagnostics v_affected = row_count;

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

  return v_affected;
end;
$$;

grant execute on function public.expire_personal_trial_profiles() to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    execute $cron$
      select cron.schedule(
        'expire-personal-trial-profiles',
        '*/30 * * * *',
        'select public.expire_personal_trial_profiles();'
      )
    $cron$;
  end if;
exception
  when others then
    null;
end $$;
