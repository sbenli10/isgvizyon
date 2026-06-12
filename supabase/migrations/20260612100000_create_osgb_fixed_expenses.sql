create table if not exists public.osgb_fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid null references public.isgkatip_companies(id) on delete set null,
  expense_item text not null,
  period_month integer not null,
  period_year integer not null,
  amount numeric(12,2) not null default 0,
  due_date date null,
  status text not null default 'pending',
  notes text null,
  is_recurring boolean not null default false,
  recurring_group_id uuid null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osgb_fixed_expenses_month_check check (period_month between 1 and 12),
  constraint osgb_fixed_expenses_year_check check (period_year between 2000 and 2100),
  constraint osgb_fixed_expenses_amount_nonnegative check (amount >= 0),
  constraint osgb_fixed_expenses_status_check check (status in ('pending', 'paid', 'overdue'))
);

create index if not exists idx_osgb_fixed_expenses_organization_id
  on public.osgb_fixed_expenses(organization_id);

create index if not exists idx_osgb_fixed_expenses_period
  on public.osgb_fixed_expenses(organization_id, period_year desc, period_month desc);

create index if not exists idx_osgb_fixed_expenses_status
  on public.osgb_fixed_expenses(organization_id, status);

create index if not exists idx_osgb_fixed_expenses_item
  on public.osgb_fixed_expenses(organization_id, expense_item);

drop trigger if exists trg_osgb_fixed_expenses_updated_at on public.osgb_fixed_expenses;
create trigger trg_osgb_fixed_expenses_updated_at
before update on public.osgb_fixed_expenses
for each row
execute function public.update_updated_at_column();

alter table public.osgb_fixed_expenses enable row level security;

drop policy if exists "OSGB fixed expense members can view records" on public.osgb_fixed_expenses;
create policy "OSGB fixed expense members can view records"
on public.osgb_fixed_expenses
for select
to authenticated
using (
  public.is_osgb_org_member(organization_id)
);

drop policy if exists "OSGB fixed expense operators can insert records" on public.osgb_fixed_expenses;
create policy "OSGB fixed expense operators can insert records"
on public.osgb_fixed_expenses
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager'])
);

drop policy if exists "OSGB fixed expense operators can update records" on public.osgb_fixed_expenses;
create policy "OSGB fixed expense operators can update records"
on public.osgb_fixed_expenses
for update
to authenticated
using (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager'])
)
with check (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager'])
);

drop policy if exists "OSGB fixed expense operators can delete records" on public.osgb_fixed_expenses;
create policy "OSGB fixed expense operators can delete records"
on public.osgb_fixed_expenses
for delete
to authenticated
using (
  public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager'])
);
