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
    raise exception 'Only organization admins can start a premium trial';
  end if;

  select trial_ends_at
  into v_existing_trial
  from public.organization_subscriptions
  where org_id = v_org_id
  limit 1;

  if v_existing_trial is not null then
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
