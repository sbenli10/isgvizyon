do $$
begin
  update public.isgkatip_companies
  set managed_at = coalesce(managed_at, last_synced_at, updated_at, created_at, now())
  where is_osgb_managed = true
    and managed_at is null;
end $$;

delete from public.osgb_client_portal_uploads upload
where not exists (
  select 1
  from public.isgkatip_companies company
  where company.id = upload.company_id
    and company.org_id = upload.organization_id
    and company.is_deleted = false
    and company.is_osgb_managed = true
);

delete from public.osgb_client_portal_links link
where not exists (
  select 1
  from public.isgkatip_companies company
  where company.id = link.company_id
    and company.org_id = link.organization_id
    and company.is_deleted = false
    and company.is_osgb_managed = true
);

create index if not exists idx_isgkatip_companies_org_managed_scope
  on public.isgkatip_companies(org_id, is_osgb_managed, company_name)
  where is_deleted = false;

create index if not exists idx_osgb_client_portal_links_org_company_active
  on public.osgb_client_portal_links(organization_id, company_id, portal_status);
