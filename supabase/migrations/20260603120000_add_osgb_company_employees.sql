create table if not exists public.osgb_company_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  full_name text not null,
  tc_number text,
  job_title text,
  department text,
  phone text,
  email text,
  start_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_company_employees_org_company
  on public.osgb_company_employees(organization_id, company_id, is_active, full_name);

create index if not exists idx_osgb_company_employees_user
  on public.osgb_company_employees(user_id, is_active, full_name);

create index if not exists idx_osgb_company_employees_tc
  on public.osgb_company_employees(organization_id, tc_number)
  where tc_number is not null;

drop trigger if exists trg_osgb_company_employees_updated_at on public.osgb_company_employees;
create trigger trg_osgb_company_employees_updated_at
before update on public.osgb_company_employees
for each row
execute function public.update_updated_at_column();

alter table public.osgb_company_employees enable row level security;

drop policy if exists "OSGB members can view company employees" on public.osgb_company_employees;
create policy "OSGB members can view company employees"
on public.osgb_company_employees
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_member(organization_id)
);

drop policy if exists "OSGB operators can insert company employees" on public.osgb_company_employees;
create policy "OSGB operators can insert company employees"
on public.osgb_company_employees
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_osgb_org_member(organization_id)
  and exists (
    select 1
    from public.isgkatip_companies company
    where company.id = company_id
      and company.org_id = organization_id
      and coalesce(company.is_deleted, false) = false
      and coalesce(company.is_osgb_managed, false) = true
  )
);

drop policy if exists "OSGB operators can update company employees" on public.osgb_company_employees;
create policy "OSGB operators can update company employees"
on public.osgb_company_employees
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
)
with check (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
);

drop policy if exists "OSGB operators can delete company employees" on public.osgb_company_employees;
create policy "OSGB operators can delete company employees"
on public.osgb_company_employees
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
);
