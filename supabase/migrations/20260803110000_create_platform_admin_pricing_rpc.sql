create or replace function public.get_platform_admin_plan_prices()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(
    jsonb_agg((to_jsonb(plan_row) - 'sort_order') order by plan_row.sort_order),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      sp.plan_code,
      sp.code,
      sp.plan_name,
      sp.name,
      sp.description,
      sp.price,
      coalesce(sp.currency, 'TRY') as currency,
      coalesce(sp.billing_period, 'monthly') as billing_period,
      coalesce(sp.is_active, true) as is_active,
      sp.updated_at,
      case coalesce(sp.plan_code, sp.code)
        when 'free' then 0
        when 'premium' then 1
        when 'osgb' then 2
        else 10
      end as sort_order
    from public.subscription_plans sp
    where coalesce(sp.plan_code, sp.code) in ('free', 'premium', 'osgb')
       or coalesce(sp.code, sp.plan_code) in ('free', 'premium', 'osgb')
  ) as plan_row;

  return v_result;
end;
$$;

create or replace function public.update_platform_admin_plan_price(
  p_plan_code text,
  p_price numeric,
  p_currency text default 'TRY',
  p_billing_period text default 'monthly',
  p_is_active boolean default true,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_plan_code, '')));
  v_currency text := upper(trim(coalesce(nullif(p_currency, ''), 'TRY')));
  v_billing_period text := lower(trim(coalesce(nullif(p_billing_period, ''), 'monthly')));
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if v_code not in ('free', 'premium', 'osgb') then
    raise exception 'Unsupported plan code: %', p_plan_code;
  end if;

  if p_price is null or p_price < 0 then
    raise exception 'Plan price must be zero or greater';
  end if;

  if v_billing_period not in ('monthly', 'yearly', 'custom') then
    raise exception 'Unsupported billing period: %', p_billing_period;
  end if;

  update public.subscription_plans sp
  set
    price = p_price,
    currency = v_currency,
    billing_period = v_billing_period,
    is_active = coalesce(p_is_active, true),
    description = case
      when p_description is null then sp.description
      else p_description
    end,
    updated_at = now()
  where lower(coalesce(sp.plan_code, sp.code)) = v_code
     or lower(coalesce(sp.code, sp.plan_code)) = v_code
  returning jsonb_build_object(
    'plan_code', sp.plan_code,
    'code', sp.code,
    'plan_name', sp.plan_name,
    'name', sp.name,
    'description', sp.description,
    'price', sp.price,
    'currency', sp.currency,
    'billing_period', sp.billing_period,
    'is_active', sp.is_active,
    'updated_at', sp.updated_at
  )
  into v_result;

  if v_result is null then
    raise exception 'Plan not found: %', p_plan_code;
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_platform_admin_plan_prices() to authenticated;
grant execute on function public.update_platform_admin_plan_price(text, numeric, text, text, boolean, text) to authenticated;
