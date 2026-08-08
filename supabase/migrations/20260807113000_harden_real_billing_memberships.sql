create table if not exists public.billing_provider_settings (
  provider_code text primary key,
  provider_name text not null,
  is_enabled boolean not null default false,
  mode text not null default 'test' check (mode in ('test', 'live')),
  public_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null,
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_code, provider_event_id)
);

alter table public.subscription_plans
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists provider_product_id text,
  add column if not exists provider_monthly_price_id text,
  add column if not exists provider_yearly_price_id text,
  add column if not exists checkout_enabled boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_payment_events_provider_status
  on public.payment_events(provider_code, status, received_at desc);

create index if not exists idx_subscription_plans_checkout_enabled
  on public.subscription_plans(checkout_enabled, is_active);

insert into public.billing_provider_settings (
  provider_code,
  provider_name,
  is_enabled,
  mode,
  public_config
)
values
  ('stripe', 'Stripe', true, 'test', jsonb_build_object('subscriptionCheckout', true, 'customerPortal', true)),
  ('iyzico', 'iyzico', false, 'test', jsonb_build_object('subscriptionCheckout', true, 'localProvider', true)),
  ('paytr', 'PayTR', false, 'test', jsonb_build_object('subscriptionCheckout', true, 'localProvider', true))
on conflict (provider_code)
do update set
  provider_name = excluded.provider_name,
  public_config = public.billing_provider_settings.public_config || excluded.public_config,
  updated_at = now();

alter table public.billing_provider_settings enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "Platform admins can manage billing provider settings" on public.billing_provider_settings;
create policy "Platform admins can manage billing provider settings"
  on public.billing_provider_settings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admins can view payment events" on public.payment_events;
create policy "Platform admins can view payment events"
  on public.payment_events
  for select
  to authenticated
  using (public.is_platform_admin());

create or replace function public.get_platform_admin_payment_events(
  p_limit integer default 100
)
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

  select coalesce(jsonb_agg(to_jsonb(event_row) order by event_row.received_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      id,
      provider_code,
      provider_event_id,
      event_type,
      status,
      error_message,
      received_at,
      processed_at
    from public.payment_events
    order by received_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ) as event_row;

  return v_result;
end;
$$;

create or replace function public.get_active_billing_provider_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'providerCode', provider_code,
        'providerName', provider_name,
        'mode', mode,
        'publicConfig', public_config
      )
      order by provider_code
    ),
    '[]'::jsonb
  )
  from public.billing_provider_settings
  where is_enabled = true;
$$;

grant execute on function public.get_platform_admin_payment_events(integer) to authenticated;
grant execute on function public.get_active_billing_provider_settings() to authenticated;
