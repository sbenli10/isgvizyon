update public.subscription_plans
set
  price = 300,
  currency = coalesce(currency, 'TRY'),
  billing_period = coalesce(billing_period, 'monthly'),
  description = coalesce(
    nullif(description, ''),
    'Premium özelliklerin tamamı ile birlikte çoklu firma, ekip, İSG-KATİP ve OSGB operasyon modülleri.'
  ),
  updated_at = now()
where plan_code = 'osgb'
   or code = 'osgb';

-- Verification:
-- select plan_code, code, plan_name, name, price, currency, billing_period
-- from public.subscription_plans
-- where plan_code = 'osgb'
--    or code = 'osgb';
