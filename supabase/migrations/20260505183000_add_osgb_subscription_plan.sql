insert into public.subscription_plans (
  plan_code,
  plan_name,
  price,
  currency,
  billing_period,
  is_active,
  max_companies,
  max_employees,
  ai_risk_analysis,
  pdf_export,
  excel_export,
  priority_support
)
select
  'osgb',
  'OSGB',
  coalesce(premium.price, 0),
  coalesce(premium.currency, 'TRY'),
  coalesce(premium.billing_period, 'monthly'),
  true,
  null,
  null,
  true,
  true,
  true,
  true
from (select 1 as seed) as base
left join lateral (
  select price, currency, billing_period
  from public.subscription_plans
  where plan_code = 'premium'
  limit 1
) as premium on true
on conflict (plan_code) do update
set
  plan_name = excluded.plan_name,
  price = excluded.price,
  billing_period = excluded.billing_period,
  currency = excluded.currency,
  is_active = true,
  max_companies = excluded.max_companies,
  max_employees = excluded.max_employees,
  ai_risk_analysis = excluded.ai_risk_analysis,
  pdf_export = excluded.pdf_export,
  excel_export = excluded.excel_export,
  priority_support = excluded.priority_support;

insert into public.plan_features (plan_code, feature_key, limit_value, is_enabled, period)
select
  'osgb',
  pf.feature_key,
  pf.limit_value,
  pf.is_enabled,
  pf.period
from public.plan_features pf
where pf.plan_code = 'premium'
on conflict (plan_code, feature_key) do update
set
  limit_value = excluded.limit_value,
  is_enabled = excluded.is_enabled,
  period = excluded.period,
  updated_at = now();

insert into public.plan_features (plan_code, feature_key, limit_value, is_enabled, period)
values ('osgb', 'osgb.access', null, true, 'lifetime')
on conflict (plan_code, feature_key) do update
set
  is_enabled = true,
  limit_value = excluded.limit_value,
  period = excluded.period,
  updated_at = now();

update public.plan_features
set
  is_enabled = false,
  updated_at = now()
where plan_code = 'premium'
  and feature_key = 'osgb.access';

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

  perform public.expire_trial_subscriptions(v_org_id);

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
      order by case
        when plan_info.plan_code = 'free' then 0
        when plan_info.plan_code = 'premium' then 1
        when plan_info.plan_code = 'osgb' then 2
        else 3
      end
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
    where sp.plan_code in ('free', 'premium', 'osgb')
       or sp.code in ('free', 'premium', 'osgb')
  ) as plan_info;

  if v_subscription.trial_ends_at is not null and v_subscription.status = 'trialing' then
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
