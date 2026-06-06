create table if not exists public.osgb_finance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  company_name text,
  period text not null,
  amount numeric(12,2) not null,
  invoice_no text,
  due_date date,
  status text not null default 'pending',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osgb_finance_records_status_check check (status in ('pending', 'paid', 'overdue')),
  constraint osgb_finance_records_amount_check check (amount >= 0),
  constraint osgb_finance_records_period_check check (period ~ '^\d{4}-\d{2}$')
);

create index if not exists idx_osgb_finance_records_organization_id
  on public.osgb_finance_records(organization_id);

create index if not exists idx_osgb_finance_records_company_id
  on public.osgb_finance_records(company_id);

create index if not exists idx_osgb_finance_records_period
  on public.osgb_finance_records(period);

create index if not exists idx_osgb_finance_records_status
  on public.osgb_finance_records(status);

create unique index if not exists idx_osgb_finance_records_unique_company_period
  on public.osgb_finance_records(organization_id, company_id, period);

alter table public.osgb_finance_records enable row level security;

drop policy if exists "Organization members can view OSGB finance records" on public.osgb_finance_records;
create policy "Organization members can view OSGB finance records"
on public.osgb_finance_records
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Organization members can insert OSGB finance records" on public.osgb_finance_records;
create policy "Organization members can insert OSGB finance records"
on public.osgb_finance_records
for insert
to authenticated
with check (public.is_organization_member(organization_id));

drop policy if exists "Organization members can update OSGB finance records" on public.osgb_finance_records;
create policy "Organization members can update OSGB finance records"
on public.osgb_finance_records
for update
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "Organization members can delete OSGB finance records" on public.osgb_finance_records;
create policy "Organization members can delete OSGB finance records"
on public.osgb_finance_records
for delete
to authenticated
using (public.is_organization_member(organization_id));

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column') then
    if not exists (select 1 from pg_trigger where tgname = 'trg_osgb_finance_records_updated_at') then
      create trigger trg_osgb_finance_records_updated_at
      before update on public.osgb_finance_records
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end
$$;
