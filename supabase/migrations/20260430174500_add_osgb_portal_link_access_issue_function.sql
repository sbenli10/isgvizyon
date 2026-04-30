create or replace function public.issue_osgb_client_portal_link_access(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_link public.osgb_client_portal_links%rowtype;
  v_org_id uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_link
  from public.osgb_client_portal_links
  where id = p_link_id;

  if not found then
    raise exception 'Portal link not found';
  end if;

  select p.organization_id
  into v_org_id
  from public.profiles p
  where p.id = auth.uid();

  if v_org_id is null or v_org_id <> v_link.organization_id then
    raise exception 'Not authorized';
  end if;

  v_token := encode(gen_random_bytes(16), 'hex');

  update public.osgb_client_portal_links
  set access_token = v_token,
      updated_at = now()
  where id = v_link.id;

  return jsonb_build_object('access_token', v_token);
end;
$$;

revoke all on function public.issue_osgb_client_portal_link_access(uuid) from public;
revoke all on function public.issue_osgb_client_portal_link_access(uuid) from anon;
grant execute on function public.issue_osgb_client_portal_link_access(uuid) to authenticated;
