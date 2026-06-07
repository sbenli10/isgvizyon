create table if not exists public.osgb_finance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  company_name text,
  period text not null,
  amount numeric(12,2) not null default 0,
  invoice_no text,
  due_date date,
  status text not null default 'pending',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osgb_finance_records_period_format check (period ~ '^\d{4}-\d{2}$'),
  constraint osgb_finance_records_amount_nonnegative check (amount >= 0),
  constraint osgb_finance_records_status_check check (status in ('pending', 'paid', 'overdue')),
  constraint osgb_finance_records_org_company_period_key unique (organization_id, company_id, period)
);

create index if not exists idx_osgb_finance_records_org_period
  on public.osgb_finance_records(organization_id, period desc, status);

create index if not exists idx_osgb_finance_records_company
  on public.osgb_finance_records(company_id, period desc);

create index if not exists idx_osgb_finance_records_due_date
  on public.osgb_finance_records(organization_id, due_date)
  where due_date is not null;

create index if not exists idx_osgb_finance_records_status
  on public.osgb_finance_records(organization_id, status);

drop trigger if exists trg_osgb_finance_records_updated_at on public.osgb_finance_records;
create trigger trg_osgb_finance_records_updated_at
before update on public.osgb_finance_records
for each row
execute function public.update_updated_at_column();

alter table public.osgb_finance_records enable row level security;

drop policy if exists "OSGB finance members can view records" on public.osgb_finance_records;
create policy "OSGB finance members can view records"
on public.osgb_finance_records
for select
to authenticated
using (
  public.is_osgb_org_member(organization_id)
);

drop policy if exists "OSGB finance members can insert records" on public.osgb_finance_records;
create policy "OSGB finance members can insert records"
on public.osgb_finance_records
for insert
to authenticated
with check (
  created_by = auth.uid()
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

drop policy if exists "OSGB finance operators can update records" on public.osgb_finance_records;
create policy "OSGB finance operators can update records"
on public.osgb_finance_records
for update
to authenticated
using (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
)
with check (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
  and exists (
    select 1
    from public.isgkatip_companies company
    where company.id = company_id
      and company.org_id = organization_id
      and coalesce(company.is_deleted, false) = false
      and coalesce(company.is_osgb_managed, false) = true
  )
);

drop policy if exists "OSGB finance operators can delete records" on public.osgb_finance_records;
create policy "OSGB finance operators can delete records"
on public.osgb_finance_records
for delete
to authenticated
using (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
);
