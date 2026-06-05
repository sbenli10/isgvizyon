create table if not exists public.user_demo_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  demo_type text not null default 'osgb_full_demo',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  activated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_demo_subscriptions_status_check check (status in ('active', 'expired', 'cancelled')),
  constraint user_demo_subscriptions_demo_type_check check (length(trim(demo_type)) > 0)
);

create unique index if not exists idx_user_demo_subscriptions_user_demo_type
  on public.user_demo_subscriptions(user_id, demo_type);

create index if not exists idx_user_demo_subscriptions_user_id
  on public.user_demo_subscriptions(user_id);

create index if not exists idx_user_demo_subscriptions_organization_id
  on public.user_demo_subscriptions(organization_id);

create index if not exists idx_user_demo_subscriptions_status
  on public.user_demo_subscriptions(status);

create index if not exists idx_user_demo_subscriptions_ends_at
  on public.user_demo_subscriptions(ends_at);

alter table public.user_demo_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_demo_subscriptions'
      and policyname = 'Users can view own demo subscriptions'
  ) then
    create policy "Users can view own demo subscriptions"
      on public.user_demo_subscriptions
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_demo_subscriptions'
      and policyname = 'Users can insert own demo subscriptions'
  ) then
    create policy "Users can insert own demo subscriptions"
      on public.user_demo_subscriptions
      for insert
      with check (auth.uid() = user_id and activated_by = auth.uid());
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_user_demo_subscriptions_updated_at'
    ) then
      create trigger trg_user_demo_subscriptions_updated_at
      before update on public.user_demo_subscriptions
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

create or replace function public.start_osgb_demo_subscription(
  p_user_id uuid,
  p_organization_id uuid default null
)
returns public.user_demo_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo public.user_demo_subscriptions%rowtype;
  v_actor uuid := auth.uid();
  v_role text := auth.role();
begin
  if v_actor is null and coalesce(v_role, '') <> 'service_role' then
    raise exception 'Not authenticated';
  end if;

  if coalesce(v_role, '') <> 'service_role' and v_actor <> p_user_id then
    raise exception 'Kendi adiniz disinda demo uyelik baslatamazsiniz.';
  end if;

  if p_user_id is null then
    raise exception 'Kullanici bilgisi zorunludur.';
  end if;

  select *
  into v_demo
  from public.user_demo_subscriptions
  where user_id = p_user_id
    and demo_type = 'osgb_full_demo'
  for update;

  if found then
    return v_demo;
  end if;

  insert into public.user_demo_subscriptions (
    user_id,
    organization_id,
    demo_type,
    status,
    started_at,
    ends_at,
    activated_by
  ) values (
    p_user_id,
    p_organization_id,
    'osgb_full_demo',
    'active',
    now(),
    now() + interval '30 days',
    coalesce(v_actor, p_user_id)
  )
  returning * into v_demo;

  return v_demo;
end;
$$;

grant execute on function public.start_osgb_demo_subscription(uuid, uuid) to authenticated;
grant execute on function public.start_osgb_demo_subscription(uuid, uuid) to service_role;
