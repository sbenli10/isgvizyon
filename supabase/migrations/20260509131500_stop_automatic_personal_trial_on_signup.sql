-- New users must start as Free. Premium trial should only start when the user
-- explicitly clicks the trial CTA, which calls billing-start-trial.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_plan'
  ) then
    alter table public.profiles alter column subscription_plan set default 'free';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_status'
  ) then
    alter table public.profiles alter column subscription_status set default 'free';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_started_at'
  ) then
    alter table public.profiles alter column subscription_started_at drop default;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'trial_ends_at'
  ) then
    alter table public.profiles alter column trial_ends_at drop default;
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_account_type text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'Kullanici'), '@', 1)
  );

  v_account_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    organization_id,
    subscription_plan,
    subscription_status,
    subscription_started_at,
    trial_ends_at,
    is_active
  )
  values (
    new.id,
    v_full_name,
    new.email,
    case when v_account_type = 'osgb' then 'admin' else 'staff' end,
    null,
    'free',
    'free',
    null,
    null,
    true
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      role = coalesce(public.profiles.role, excluded.role),
      is_active = coalesce(public.profiles.is_active, excluded.is_active),
      updated_at = now();

  return new;
end;
$$;

create or replace function public.bootstrap_signup_individual_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'Auth user not found for individual signup bootstrap';
  end if;

  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    subscription_plan,
    subscription_status,
    subscription_started_at,
    trial_ends_at,
    is_active
  )
  values (
    p_user_id,
    null,
    nullif(trim(p_full_name), ''),
    nullif(trim(p_email), ''),
    'staff',
    'free',
    'free',
    null,
    null,
    true
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      role = coalesce(public.profiles.role, excluded.role),
      is_active = coalesce(public.profiles.is_active, excluded.is_active),
      updated_at = now();

  return p_user_id;
end;
$$;

grant execute on function public.bootstrap_signup_individual_profile(uuid, text, text) to anon;
grant execute on function public.bootstrap_signup_individual_profile(uuid, text, text) to authenticated;

