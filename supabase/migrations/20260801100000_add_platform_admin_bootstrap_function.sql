create or replace function public.bootstrap_platform_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger record;
  v_normalized_email text := lower(trim(p_email));
  v_updated_count integer := 0;
begin
  if v_normalized_email is null or v_normalized_email = '' then
    raise exception 'E-posta adresi gerekli.';
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
      is_platform_admin = true,
      role = case
        when role is null or trim(role) = '' or role = 'viewer' then 'platform_admin'
        else role
      end,
      is_active = true,
      updated_at = now()
    where lower(email) = v_normalized_email;

    get diagnostics v_updated_count = row_count;

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

    if v_updated_count = 0 then
      raise exception 'Bu e-posta ile profiles kaydı bulunamadı: %', v_normalized_email;
    end if;
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
end;
$$;

revoke all on function public.bootstrap_platform_admin(text) from public;
revoke all on function public.bootstrap_platform_admin(text) from anon;
revoke all on function public.bootstrap_platform_admin(text) from authenticated;
grant execute on function public.bootstrap_platform_admin(text) to service_role;
