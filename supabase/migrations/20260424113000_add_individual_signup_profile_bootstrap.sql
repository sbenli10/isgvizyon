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
    is_active
  )
  values (
    p_user_id,
    null,
    nullif(trim(p_full_name), ''),
    nullif(trim(p_email), ''),
    'staff',
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
