-- Harden organization-based subscription management and add billing helpers.

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.subscription_plans(plan_code) on delete cascade,
  feature_key text not null,
  limit_value integer,
  is_enabled boolean not null default true,
  period text check (period in ('monthly', 'lifetime') or period is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_code, feature_key)
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null references public.subscription_plans(plan_code),
  status text not null default 'active' check (status in ('active', 'trialing', 'canceled', 'past_due')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create table if not exists public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  period_key text,
  usage_count integer not null default 0,
  usage_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, feature_key, period_key)
);

alter table public.organization_subscriptions
  add column if not exists billing_provider text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists last_checkout_session_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.billing_history
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists provider text,
  add column if not exists provider_reference text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_plan_features_plan_code on public.plan_features(plan_code);
create index if not exists idx_plan_features_feature_key on public.plan_features(feature_key);
create index if not exists idx_org_subscriptions_org_id on public.organization_subscriptions(org_id);
create index if not exists idx_org_subscriptions_plan_code on public.organization_subscriptions(plan_code);
create index if not exists idx_org_subscriptions_stripe_customer_id on public.organization_subscriptions(stripe_customer_id);
create index if not exists idx_org_subscriptions_stripe_subscription_id on public.organization_subscriptions(stripe_subscription_id);
create index if not exists idx_feature_usage_org_feature on public.feature_usage(org_id, feature_key);
create index if not exists idx_feature_usage_period_key on public.feature_usage(period_key);
create index if not exists idx_billing_history_org_id on public.billing_history(organization_id);

alter table public.plan_features enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.feature_usage enable row level security;

create or replace function public.get_current_period_key(p_period text)
returns text
language sql
stable
as $$
  select case
    when p_period = 'monthly' then to_char(timezone('UTC', now()), 'YYYY-MM')
    when p_period = 'lifetime' then 'lifetime'
    else null
  end
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
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
    where p.id = auth.uid()
      and p.organization_id = _organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'plan_features'
      and policyname = 'Authenticated users can view plan features'
  ) then
    create policy "Authenticated users can view plan features"
      on public.plan_features
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_subscriptions'
      and policyname = 'Organization members can view subscriptions'
  ) then
    create policy "Organization members can view subscriptions"
      on public.organization_subscriptions
      for select
      to authenticated
      using (public.is_organization_member(org_id));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feature_usage'
      and policyname = 'Organization members can view feature usage'
  ) then
    create policy "Organization members can view feature usage"
      on public.feature_usage
      for select
      to authenticated
      using (public.is_organization_member(org_id));
  end if;
end
$$;

create or replace function public.get_my_subscription_features()
returns table (
  org_id uuid,
  plan_code text,
  feature_key text,
  is_enabled boolean,
  limit_value integer,
  period text,
  current_usage integer,
  current_value bigint
)
language sql
security definer
set search_path = public
as $$
  with my_org as (
    select public.get_my_organization_id() as organization_id
  ),
  my_subscription as (
    select os.org_id, os.plan_code
    from public.organization_subscriptions os
    join my_org mo on mo.organization_id = os.org_id
    where os.status in ('active', 'trialing', 'past_due')
    limit 1
  )
  select
    ms.org_id,
    ms.plan_code,
    pf.feature_key,
    pf.is_enabled,
    pf.limit_value,
    pf.period,
    coalesce(fu.usage_count, 0)::integer as current_usage,
    coalesce(fu.usage_value, 0)::bigint as current_value
  from my_subscription ms
  join public.plan_features pf
    on pf.plan_code = ms.plan_code
  left join public.feature_usage fu
    on fu.org_id = ms.org_id
   and fu.feature_key = pf.feature_key
   and fu.period_key is not distinct from public.get_current_period_key(pf.period)
  order by pf.feature_key
$$;

create or replace function public.check_my_feature_access(
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
  with feature_row as (
    select *
    from public.get_my_subscription_features()
    where feature_key = p_feature_key
    limit 1
  )
  select
    fr.org_id,
    fr.plan_code,
    fr.feature_key,
    fr.is_enabled,
    fr.limit_value,
    fr.period,
    fr.current_usage,
    fr.current_value,
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
$$;

create or replace function public.increment_my_feature_usage(
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
  v_org_id uuid;
  v_plan_code text;
  v_period text;
  v_period_key text;
  v_enabled boolean;
  v_limit integer;
  v_current_usage integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_feature_key), '') = '' then
    raise exception 'Feature key is required';
  end if;

  v_org_id := public.get_my_organization_id();

  if v_org_id is null then
    raise exception 'Organization not found for current user';
  end if;

  select
    os.plan_code,
    pf.period,
    pf.is_enabled,
    pf.limit_value
  into
    v_plan_code,
    v_period,
    v_enabled,
    v_limit
  from public.organization_subscriptions os
  join public.plan_features pf
    on pf.plan_code = os.plan_code
  where os.org_id = v_org_id
    and os.status in ('active', 'trialing', 'past_due')
    and pf.feature_key = p_feature_key
  limit 1;

  if v_plan_code is null then
    raise exception 'Feature entitlement not found';
  end if;

  if v_enabled = false then
    raise exception 'Feature is disabled for current plan';
  end if;

  v_period_key := public.get_current_period_key(v_period);

  select coalesce(fu.usage_count, 0)
  into v_current_usage
  from public.feature_usage fu
  where fu.org_id = v_org_id
    and fu.feature_key = p_feature_key
    and fu.period_key is not distinct from v_period_key
  limit 1;

  if v_limit is not null and (coalesce(v_current_usage, 0) + greatest(p_by_count, 0)) > v_limit then
    raise exception 'Feature limit exceeded for %', p_feature_key;
  end if;

  insert into public.feature_usage (
    org_id,
    feature_key,
    period_key,
    usage_count,
    usage_value
  )
  values (
    v_org_id,
    p_feature_key,
    v_period_key,
    greatest(p_by_count, 0),
    greatest(p_by_value, 0)
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
  where fu.org_id = v_org_id
    and fu.feature_key = p_feature_key
    and fu.period_key is not distinct from v_period_key
  limit 1;
end;
$$;

create or replace function public.get_my_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_is_admin boolean;
  v_subscription record;
  v_entitlements jsonb := '[]'::jsonb;
  v_plans jsonb := '[]'::jsonb;
  v_trial_days integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_organization_id();

  if v_org_id is null then
    raise exception 'Organization not found for current user';
  end if;

  v_is_admin := public.is_organization_admin(v_org_id);

  select
    os.*,
    coalesce(sp.code, sp.plan_code, os.plan_code) as resolved_plan_code,
    coalesce(sp.name, sp.plan_name, initcap(os.plan_code)) as resolved_plan_name,
    coalesce(sp.description, '') as resolved_description,
    sp.price as resolved_price,
    coalesce(sp.currency, 'TRY') as resolved_currency,
    coalesce(sp.billing_period, 'monthly') as resolved_billing_period
  into v_subscription
  from public.organization_subscriptions os
  left join public.subscription_plans sp
    on sp.plan_code = os.plan_code
      or sp.code = os.plan_code
  where os.org_id = v_org_id
  order by
    case
      when os.status in ('active', 'trialing', 'past_due') then 0
      else 1
    end,
    os.updated_at desc
  limit 1;

  if v_subscription is null then
    insert into public.organization_subscriptions (org_id, plan_code, status)
    values (v_org_id, 'free', 'active')
    on conflict (org_id) do nothing;

    select
      os.*,
      coalesce(sp.code, sp.plan_code, os.plan_code) as resolved_plan_code,
      coalesce(sp.name, sp.plan_name, initcap(os.plan_code)) as resolved_plan_name,
      coalesce(sp.description, '') as resolved_description,
      sp.price as resolved_price,
      coalesce(sp.currency, 'TRY') as resolved_currency,
      coalesce(sp.billing_period, 'monthly') as resolved_billing_period
    into v_subscription
    from public.organization_subscriptions os
    left join public.subscription_plans sp
      on sp.plan_code = os.plan_code
        or sp.code = os.plan_code
    where os.org_id = v_org_id
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'featureKey', pf.feature_key,
        'isEnabled', pf.is_enabled,
        'limitValue', pf.limit_value,
        'period', pf.period,
        'currentUsage', coalesce(fu.usage_count, 0),
        'currentValue', coalesce(fu.usage_value, 0),
        'allowed',
          case
            when pf.is_enabled = false then false
            when pf.limit_value is null then true
            when coalesce(fu.usage_count, 0) < pf.limit_value then true
            else false
          end
      )
      order by pf.feature_key
    ),
    '[]'::jsonb
  )
  into v_entitlements
  from public.plan_features pf
  left join public.feature_usage fu
    on fu.org_id = v_org_id
   and fu.feature_key = pf.feature_key
   and fu.period_key is not distinct from public.get_current_period_key(pf.period)
  where pf.plan_code = v_subscription.plan_code;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'planCode', plan_info.plan_code,
        'planName', plan_info.plan_name,
        'description', plan_info.description,
        'price', plan_info.price,
        'currency', plan_info.currency,
        'billingPeriod', plan_info.billing_period,
        'isCurrent', plan_info.plan_code = v_subscription.plan_code,
        'features',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'featureKey', pf.feature_key,
                  'isEnabled', pf.is_enabled,
                  'limitValue', pf.limit_value,
                  'period', pf.period
                )
                order by pf.feature_key
              )
              from public.plan_features pf
              where pf.plan_code = plan_info.plan_code
            ),
            '[]'::jsonb
          )
      )
      order by case when plan_info.plan_code = 'free' then 0 when plan_info.plan_code = 'premium' then 1 else 2 end
    ),
    '[]'::jsonb
  )
  into v_plans
  from (
    select distinct
      sp.plan_code,
      coalesce(sp.name, sp.plan_name, initcap(sp.plan_code)) as plan_name,
      coalesce(sp.description, '') as description,
      sp.price,
      coalesce(sp.currency, 'TRY') as currency,
      coalesce(sp.billing_period, 'monthly') as billing_period
    from public.subscription_plans sp
    where sp.plan_code in ('free', 'premium')
       or sp.code in ('free', 'premium')
  ) as plan_info;

  if v_subscription.trial_ends_at is not null then
    v_trial_days := greatest(0, ceil(extract(epoch from (v_subscription.trial_ends_at - now())) / 86400.0)::integer);
  end if;

  return jsonb_build_object(
    'organizationId', v_org_id,
    'isOrganizationAdmin', v_is_admin,
    'planCode', coalesce(v_subscription.plan_code, 'free'),
    'planName', coalesce(v_subscription.resolved_plan_name, 'Free'),
    'status', coalesce(v_subscription.status, 'active'),
    'description', coalesce(v_subscription.resolved_description, ''),
    'price', v_subscription.resolved_price,
    'currency', coalesce(v_subscription.resolved_currency, 'TRY'),
    'billingPeriod', coalesce(v_subscription.resolved_billing_period, 'monthly'),
    'trialStartedAt', v_subscription.trial_started_at,
    'trialEndsAt', v_subscription.trial_ends_at,
    'daysLeftInTrial', v_trial_days,
    'currentPeriodStart', v_subscription.current_period_start,
    'currentPeriodEnd', v_subscription.current_period_end,
    'cancelAtPeriodEnd', coalesce(v_subscription.cancel_at_period_end, false),
    'canceledAt', v_subscription.canceled_at,
    'hasStripeCustomer', v_subscription.stripe_customer_id is not null,
    'hasStripeSubscription', v_subscription.stripe_subscription_id is not null,
    'canStartTrial',
      v_is_admin
      and coalesce(v_subscription.plan_code, 'free') = 'free'
      and v_subscription.trial_started_at is null,
    'entitlements', v_entitlements,
    'plans', v_plans
  );
end;
$$;

create or replace function public.start_my_premium_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_existing record;
  v_trial_ends_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_organization_id();

  if v_org_id is null then
    raise exception 'Organization not found for current user';
  end if;

  if not public.is_organization_admin(v_org_id) then
    raise exception 'Only organization admins can start a premium trial';
  end if;

  select *
  into v_existing
  from public.organization_subscriptions
  where org_id = v_org_id
  limit 1;

  if v_existing is not null and v_existing.trial_started_at is not null then
    raise exception 'Premium deneme suresi bu organizasyon icin zaten kullanilmis';
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
    canceled_at,
    updated_at
  )
  values (
    v_org_id,
    'premium',
    'trialing',
    now(),
    now(),
    v_trial_ends_at,
    now(),
    v_trial_ends_at,
    false,
    null,
    now()
  )
  on conflict (org_id)
  do update
    set plan_code = 'premium',
        status = 'trialing',
        starts_at = now(),
        trial_started_at = now(),
        trial_ends_at = v_trial_ends_at,
        current_period_start = now(),
        current_period_end = v_trial_ends_at,
        cancel_at_period_end = false,
        canceled_at = null,
        updated_at = now();

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
    'Premium Trial',
    0,
    'TRY',
    'paid',
    now(),
    now(),
    v_trial_ends_at,
    'Trial',
    'internal',
    'trial',
    jsonb_build_object('source', 'start_my_premium_trial')
  );

  return public.get_my_billing_overview();
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
  v_month_start timestamptz;
  v_next_month timestamptz;
  v_companies integer := 0;
  v_employees integer := 0;
  v_risk_assessments integer := 0;
  v_inspections_monthly integer := 0;
  v_capa integer := 0;
  v_adep integer := 0;
  v_annual_plans integer := 0;
  v_board_meetings integer := 0;
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
  v_month_start := date_trunc('month', timezone('UTC', now()));
  v_next_month := v_month_start + interval '1 month';

  select count(*)
  into v_companies
  from public.companies c
  where exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org_id
      and p.id = c.user_id
  );

  select count(*)
  into v_employees
  from public.employees e
  join public.companies c on c.id = e.company_id
  where exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org_id
      and p.id = c.user_id
  );

  select count(*)
  into v_risk_assessments
  from public.risk_assessments ra
  left join public.companies c on c.id = ra.company_id
  where exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org_id
      and (
        p.id = ra.user_id
        or p.id = c.user_id
      )
  );

  select count(*)
  into v_inspections_monthly
  from public.inspections i
  where i.org_id = v_org_id
    and coalesce(i.created_at, now()) >= v_month_start
    and coalesce(i.created_at, now()) < v_next_month;

  select count(*)
  into v_capa
  from public.capa_records cr
  where cr.org_id = v_org_id;

  select count(*)
  into v_adep
  from public.adep_plans ap
  where ap.org_id = v_org_id
    and coalesce(ap.is_deleted, false) = false;

  select count(*)
  into v_annual_plans
  from public.annual_plans a
  where exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org_id
      and p.id = a.user_id
  );

  select count(*)
  into v_board_meetings
  from public.board_meetings bm
  join public.companies c on c.id = bm.company_id
  where exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org_id
      and p.id = c.user_id
  );

  delete from public.feature_usage
  where org_id = v_org_id
    and (
      (feature_key in ('companies.count', 'employees.count', 'risk_assessments.count', 'capa.count', 'adep.count', 'annual_plans.count', 'board_meetings.count') and period_key = 'lifetime')
      or (feature_key in ('inspections.count_monthly') and period_key = v_month_key)
    );

  insert into public.feature_usage (org_id, feature_key, period_key, usage_count, usage_value)
  values
    (v_org_id, 'companies.count', 'lifetime', v_companies, 0),
    (v_org_id, 'employees.count', 'lifetime', v_employees, 0),
    (v_org_id, 'risk_assessments.count', 'lifetime', v_risk_assessments, 0),
    (v_org_id, 'capa.count', 'lifetime', v_capa, 0),
    (v_org_id, 'adep.count', 'lifetime', v_adep, 0),
    (v_org_id, 'annual_plans.count', 'lifetime', v_annual_plans, 0),
    (v_org_id, 'board_meetings.count', 'lifetime', v_board_meetings, 0),
    (v_org_id, 'inspections.count_monthly', v_month_key, v_inspections_monthly, 0)
  on conflict (org_id, feature_key, period_key)
  do update
    set usage_count = excluded.usage_count,
        usage_value = excluded.usage_value,
        updated_at = now();

  return jsonb_build_object(
    'organizationId', v_org_id,
    'counts', jsonb_build_object(
      'companies.count', v_companies,
      'employees.count', v_employees,
      'risk_assessments.count', v_risk_assessments,
      'capa.count', v_capa,
      'adep.count', v_adep,
      'annual_plans.count', v_annual_plans,
      'board_meetings.count', v_board_meetings,
      'inspections.count_monthly', v_inspections_monthly
    )
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.set_organization_plan(uuid,text,text)') is not null then
    revoke execute on function public.set_organization_plan(uuid, text, text) from anon, authenticated;
    grant execute on function public.set_organization_plan(uuid, text, text) to service_role;
  end if;

  if to_regprocedure('public.set_plan_for_org(uuid,text,text)') is not null then
    revoke execute on function public.set_plan_for_org(uuid, text, text) from anon, authenticated;
    grant execute on function public.set_plan_for_org(uuid, text, text) to service_role;
  end if;

  if to_regprocedure('public.check_feature_access_for_org(uuid,text)') is not null then
    revoke execute on function public.check_feature_access_for_org(uuid, text) from anon, authenticated;
    grant execute on function public.check_feature_access_for_org(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.increment_feature_usage_for_org(uuid,text,integer,bigint)') is not null then
    revoke execute on function public.increment_feature_usage_for_org(uuid, text, integer, bigint) from anon, authenticated;
    grant execute on function public.increment_feature_usage_for_org(uuid, text, integer, bigint) to service_role;
  end if;
end
$$;

grant execute on function public.get_current_period_key(text) to authenticated;
grant execute on function public.get_my_organization_id() to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.get_my_subscription_features() to authenticated;
grant execute on function public.check_my_feature_access(text) to authenticated;
grant execute on function public.increment_my_feature_usage(text, integer, bigint) to authenticated;
grant execute on function public.get_my_billing_overview() to authenticated;
grant execute on function public.start_my_premium_trial() to authenticated;
grant execute on function public.backfill_my_feature_usage() to authenticated;
