update public.subscription_plans
set
  price = 250,
  currency = coalesce(currency, 'TRY'),
  billing_period = coalesce(billing_period, 'monthly'),
  updated_at = now()
where plan_code = 'premium'
   or code = 'premium';
