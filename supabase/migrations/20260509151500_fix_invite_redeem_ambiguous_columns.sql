-- Fix ambiguous `organization_id` references caused by RETURNS TABLE output names
-- shadowing table columns in PL/pgSQL.

create or replace function public.redeem_organization_invite(p_code text)
returns table (
  organization_id uuid,
  organization_name text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_invite public.organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadi';
  end if;

  if coalesce(trim(p_code), '') = '' then
    raise exception 'Davet kodu zorunludur';
  end if;

  select oi.*
  into v_invite
  from public.organization_invites oi
  where upper(oi.code) = upper(trim(p_code))
    and oi.is_active = true
    and (oi.expires_at is null or oi.expires_at > now())
    and oi.used_count < oi.max_uses
  order by oi.created_at desc
  limit 1;

  if not found then
    raise exception 'Davet kodu gecersiz veya suresi dolmus';
  end if;

  if public.get_org_effective_plan(v_invite.organization_id) <> 'osgb' then
    raise exception 'Bu organizasyona davet ile katilim icin OSGB plani aktif olmalidir';
  end if;

  insert into public.organization_members as om (organization_id, user_id, role, status)
  values (v_invite.organization_id, v_user_id, 'staff', 'active')
  on conflict (organization_id, user_id) do update
  set status = 'active',
      role = case when om.role = 'owner' then 'owner' else 'staff' end,
      updated_at = now();

  perform public.set_profile_workspace(v_user_id, v_invite.organization_id, 'staff');

  update public.organization_invites oi
  set used_count = oi.used_count + 1,
      is_active = case when oi.used_count + 1 >= oi.max_uses then false else oi.is_active end,
      used_by = v_user_id,
      used_at = now(),
      updated_at = now()
  where oi.id = v_invite.id;

  update public.organization_join_requests ojr
  set status = 'cancelled',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now()
  where ojr.requester_id = v_user_id
    and ojr.status = 'pending';

  return query
  select org.id, org.name
  from public.organizations org
  where org.id = v_invite.organization_id;
end;
$$;

grant execute on function public.redeem_organization_invite(text) to authenticated;
