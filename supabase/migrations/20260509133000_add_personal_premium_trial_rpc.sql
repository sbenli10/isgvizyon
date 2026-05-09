create or replace function public.start_my_personal_premium_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_trial_ends_at timestamptz := now() + interval '7 days';
  v_trigger record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profil kaydi bulunamadi.';
  end if;

  if v_profile.organization_id is not null then
    raise exception 'Kisisel demo yalnizca organizasyonsuz kullanicilar icindir.';
  end if;

  if lower(coalesce(v_profile.subscription_status, 'free')) in ('trial', 'active', 'premium') then
    raise exception 'Aktif bir Premium uyeliginiz veya denemeniz zaten bulunuyor.';
  end if;

  if lower(coalesce(v_profile.subscription_plan, 'free')) = 'premium'
     and (v_profile.subscription_started_at is not null or v_profile.trial_ends_at is not null) then
    raise exception '7 gunluk Premium demo hakkinizi daha once kullandiniz.';
  end if;

  for v_trigger in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.profiles'::regclass
      and p.proname = 'protect_profile_sensitive_fields'
      and not t.tgisinternal
  loop
    execute format('alter table public.profiles disable trigger %I', v_trigger.tgname);
  end loop;

  begin
    update public.profiles
    set
      subscription_plan = 'premium',
      subscription_status = 'trial',
      subscription_started_at = now(),
      trial_ends_at = v_trial_ends_at,
      updated_at = now()
    where id = v_user_id;

    for v_trigger in
      select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.profiles'::regclass
        and p.proname = 'protect_profile_sensitive_fields'
        and not t.tgisinternal
    loop
      execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
    end loop;
  exception
    when others then
      for v_trigger in
        select t.tgname
        from pg_trigger t
        join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = 'public.profiles'::regclass
          and p.proname = 'protect_profile_sensitive_fields'
          and not t.tgisinternal
      loop
        execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
      end loop;

      raise;
  end;

  return jsonb_build_object(
    'mode', 'personal',
    'planCode', 'premium',
    'status', 'trial',
    'trialEndsAt', v_trial_ends_at,
    'daysLeftInTrial', greatest(0, ceil(extract(epoch from (v_trial_ends_at - now())) / 86400.0)::integer)
  );
end;
$$;

grant execute on function public.start_my_personal_premium_trial() to authenticated;

