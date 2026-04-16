alter table if exists public.osgb_field_visits
  add column if not exists compliance_impact_minutes integer not null default 0;

create table if not exists public.osgb_required_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  obligation_id uuid references public.osgb_company_obligations(id) on delete set null,
  field_visit_id uuid references public.osgb_field_visits(id) on delete set null,
  document_type text not null,
  required_reason text not null,
  risk_if_missing text,
  due_date date,
  status text not null default 'missing' check (status in ('missing', 'submitted', 'approved', 'rejected')),
  delay_days integer not null default 0,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  finance_account_id uuid references public.osgb_finance_accounts(id) on delete set null,
  contract_id uuid references public.osgb_service_contracts(id) on delete set null,
  service_month date,
  entry_type text not null check (entry_type in ('invoice', 'payment', 'adjustment')),
  amount numeric(12,2) not null default 0,
  entry_date date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('draft', 'open', 'paid', 'cancelled', 'overdue', 'posted')),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_required_documents_org_status
  on public.osgb_required_documents(organization_id, status, due_date);

create index if not exists idx_osgb_required_documents_company
  on public.osgb_required_documents(company_id, obligation_id, due_date);

create index if not exists idx_osgb_financial_entries_org_company
  on public.osgb_financial_entries(organization_id, company_id, entry_date desc);

create index if not exists idx_osgb_financial_entries_service_month
  on public.osgb_financial_entries(organization_id, service_month, entry_type, status);

alter table public.osgb_required_documents enable row level security;
alter table public.osgb_financial_entries enable row level security;

drop trigger if exists trg_osgb_required_documents_apply_scope on public.osgb_required_documents;
create trigger trg_osgb_required_documents_apply_scope
before insert on public.osgb_required_documents
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_financial_entries_apply_scope on public.osgb_financial_entries;
create trigger trg_osgb_financial_entries_apply_scope
before insert on public.osgb_financial_entries
for each row
execute function public.osgb_apply_default_scope();

drop policy if exists "Organization members can view required documents" on public.osgb_required_documents;
drop policy if exists "Organization members can manage required documents" on public.osgb_required_documents;

create policy "Organization members can view required documents"
on public.osgb_required_documents
for select
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage required documents"
on public.osgb_required_documents
for all
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));

drop policy if exists "Organization members can view financial entries" on public.osgb_financial_entries;
drop policy if exists "Organization members can manage financial entries" on public.osgb_financial_entries;

create policy "Organization members can view financial entries"
on public.osgb_financial_entries
for select
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage financial entries"
on public.osgb_financial_entries
for all
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));
