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
  v_profile public.profiles%rowtype;
  v_effective_org_id uuid;
  v_has_active_paid_subscription boolean := false;
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
  into v_profile
  from public.profiles
  where id = p_user_id;

  v_effective_org_id := coalesce(p_organization_id, v_profile.organization_id);

  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and lower(coalesce(p.subscription_plan, 'free')) in ('premium', 'osgb')
      and lower(coalesce(p.subscription_status, 'free')) in ('active', 'premium')
  )
  or exists (
    select 1
    from public.organization_subscriptions os
    where os.org_id = v_effective_org_id
      and lower(coalesce(os.plan_code, 'free')) in ('premium', 'osgb')
      and lower(coalesce(os.status, '')) = 'active'
      and (os.ends_at is null or os.ends_at > now())
  )
  into v_has_active_paid_subscription;

  if v_has_active_paid_subscription then
    raise exception 'Aktif üyeliği olan kullanıcı demo başlatamaz.';
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
    v_effective_org_id,
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
