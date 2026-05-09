-- Public pricing pages must be able to read active plan prices without login.
-- This exposes only the subscription catalog rows already shown on marketing/billing screens.

alter table if exists public.subscription_plans enable row level security;

drop policy if exists "Anyone can read active subscription plan prices" on public.subscription_plans;
create policy "Anyone can read active subscription plan prices"
on public.subscription_plans
for select
to anon, authenticated
using (
  coalesce(is_active, true) = true
);

-- Verification as anon/authenticated:
-- select plan_code, code, plan_name, name, price, currency, billing_period
-- from public.subscription_plans
-- where coalesce(is_active, true) = true
--   and (plan_code in ('free', 'premium', 'osgb') or code in ('free', 'premium', 'osgb'));
