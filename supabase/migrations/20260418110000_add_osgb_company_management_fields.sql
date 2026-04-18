alter table public.isgkatip_companies
  add column if not exists is_osgb_managed boolean not null default false,
  add column if not exists management_source text not null default 'extension',
  add column if not exists tax_number text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists contact_name text,
  add column if not exists assignment_mode text not null default 'automatic',
  add column if not exists visit_frequency text not null default 'monthly_once',
  add column if not exists notes text,
  add column if not exists managed_at timestamptz;

create index if not exists idx_isgkatip_companies_org_managed
  on public.isgkatip_companies(org_id, is_osgb_managed, is_deleted, company_name);

update public.isgkatip_companies c
set is_osgb_managed = true,
    managed_at = coalesce(c.managed_at, now())
where coalesce(c.is_osgb_managed, false) = false
  and (
    exists (
      select 1
      from public.osgb_service_contracts sc
      where sc.company_id = c.id
        and sc.organization_id = c.org_id
    )
    or exists (
      select 1
      from public.osgb_assignments a
      where a.company_id = c.id
        and a.organization_id = c.org_id
    )
    or exists (
      select 1
      from public.osgb_finance_accounts fa
      where fa.company_id = c.id
        and fa.organization_id = c.org_id
    )
  );

alter table public.isgkatip_companies enable row level security;

drop policy if exists "OSGB members can view isgkatip companies" on public.isgkatip_companies;
create policy "OSGB members can view isgkatip companies"
on public.isgkatip_companies
for select
to authenticated
using (public.is_osgb_org_member(org_id));

drop policy if exists "OSGB members can manage isgkatip companies" on public.isgkatip_companies;
create policy "OSGB members can manage isgkatip companies"
on public.isgkatip_companies
for all
to authenticated
using (public.is_osgb_org_member(org_id))
with check (public.is_osgb_org_member(org_id));
