do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('current_org_id', ''),
        ('get_my_organization_id', ''),
        ('is_org_member', 'uuid'),
        ('has_org_role', 'uuid, text[]'),
        ('is_organization_member', 'uuid'),
        ('is_organization_admin', 'uuid'),
        ('is_osgb_org_member', 'uuid'),
        ('is_osgb_org_role', 'uuid, text[]')
    ) as needed(proname, args)
    where exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = needed.proname
        and pg_get_function_identity_arguments(p.oid) = needed.args
    )
  loop
    execute format(
      'grant execute on function public.%I(%s) to authenticated',
      rec.proname,
      rec.args
    );
  end loop;
end
$$;
