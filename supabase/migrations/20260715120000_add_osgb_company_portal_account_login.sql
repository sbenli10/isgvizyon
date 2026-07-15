create or replace function public.authenticate_osgb_company_portal_account(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account record;
  v_link record;
  v_token text;
begin
  select
    account.id,
    account.user_id,
    account.organization_id,
    account.company_id,
    account.username
  into v_account
  from public.osgb_company_portal_accounts account
  join public.isgkatip_companies company on company.id = account.company_id
  where lower(account.username) = lower(trim(p_username))
    and account.password_plain = p_password
    and account.is_active = true
    and coalesce(company.is_deleted, false) = false
    and coalesce(company.is_osgb_managed, false) = true
  order by account.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'Firma giris bilgileri dogrulanamadi veya hesap pasif.'
    );
  end if;

  select *
  into v_link
  from public.osgb_client_portal_links link
  where link.organization_id = v_account.organization_id
    and link.company_id = v_account.company_id
    and link.portal_status = 'active'
    and (link.expires_at is null or link.expires_at > now())
  order by link.created_at desc
  limit 1;

  v_token := replace(gen_random_uuid()::text, '-', '');

  if found then
    update public.osgb_client_portal_links
    set access_token = v_token,
        portal_status = 'active',
        updated_at = now()
    where id = v_link.id;
  else
    insert into public.osgb_client_portal_links (
      organization_id,
      company_id,
      access_token,
      portal_status,
      created_by
    )
    values (
      v_account.organization_id,
      v_account.company_id,
      v_token,
      'active',
      v_account.user_id
    );
  end if;

  update public.osgb_company_portal_accounts
  set last_login_at = now(),
      updated_at = now()
  where id = v_account.id;

  return jsonb_build_object(
    'ok', true,
    'access_token', v_token,
    'portal_path', '/portal/company/' || v_token
  );
end;
$$;

revoke all on function public.authenticate_osgb_company_portal_account(text, text) from public;
grant execute on function public.authenticate_osgb_company_portal_account(text, text) to anon;
grant execute on function public.authenticate_osgb_company_portal_account(text, text) to authenticated;
