alter table if exists public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table if exists public.profiles
  add constraint profiles_subscription_plan_check
  check (
    subscription_plan is null
    or subscription_plan in ('free', 'premium', 'osgb')
  );

alter table if exists public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table if exists public.profiles
  add constraint profiles_subscription_status_check
  check (
    subscription_status is null
    or subscription_status in ('free', 'trial', 'active', 'premium', 'past_due', 'cancelled', 'canceled')
  );

