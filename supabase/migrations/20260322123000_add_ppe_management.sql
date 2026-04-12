create table if not exists public.ppe_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  category text not null,
  standard_code text,
  default_renewal_days integer not null default 365,
  stock_quantity integer not null default 0,
  min_stock_level integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ppe_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.ppe_inventory(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  assigned_date date not null default current_date,
  due_date date not null,
  return_date date,
  status text not null default 'assigned' check (status in ('assigned', 'replacement_due', 'returned')),
  quantity integer not null default 1,
  size_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ppe_inventory_user_active
  on public.ppe_inventory(user_id, is_active);

create index if not exists idx_ppe_assignments_user_status_due
  on public.ppe_assignments(user_id, status, due_date);

create index if not exists idx_ppe_assignments_employee
  on public.ppe_assignments(employee_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ppe_inventory_stock_quantity_check'
  ) then
    alter table public.ppe_inventory
      add constraint ppe_inventory_stock_quantity_check check (stock_quantity >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ppe_inventory_min_stock_level_check'
  ) then
    alter table public.ppe_inventory
      add constraint ppe_inventory_min_stock_level_check check (min_stock_level >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ppe_inventory_default_renewal_days_check'
  ) then
    alter table public.ppe_inventory
      add constraint ppe_inventory_default_renewal_days_check check (default_renewal_days > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ppe_assignments_quantity_check'
  ) then
    alter table public.ppe_assignments
      add constraint ppe_assignments_quantity_check check (quantity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ppe_assignments_due_date_check'
  ) then
    alter table public.ppe_assignments
      add constraint ppe_assignments_due_date_check check (due_date >= assigned_date);
  end if;
end $$;

alter table public.ppe_inventory enable row level security;
alter table public.ppe_assignments enable row level security;

drop policy if exists "Users can view own ppe inventory" on public.ppe_inventory;
drop policy if exists "Users can insert own ppe inventory" on public.ppe_inventory;
drop policy if exists "Users can update own ppe inventory" on public.ppe_inventory;
drop policy if exists "Users can delete own ppe inventory" on public.ppe_inventory;

create policy "Users can view own ppe inventory"
on public.ppe_inventory for select
using (auth.uid() = user_id);

create policy "Users can insert own ppe inventory"
on public.ppe_inventory for insert
with check (auth.uid() = user_id);

create policy "Users can update own ppe inventory"
on public.ppe_inventory for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own ppe inventory"
on public.ppe_inventory for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own ppe assignments" on public.ppe_assignments;
drop policy if exists "Users can insert own ppe assignments" on public.ppe_assignments;
drop policy if exists "Users can update own ppe assignments" on public.ppe_assignments;
drop policy if exists "Users can delete own ppe assignments" on public.ppe_assignments;

create policy "Users can view own ppe assignments"
on public.ppe_assignments for select
using (auth.uid() = user_id);

create policy "Users can insert own ppe assignments"
on public.ppe_assignments for insert
with check (auth.uid() = user_id);

create policy "Users can update own ppe assignments"
on public.ppe_assignments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own ppe assignments"
on public.ppe_assignments for delete
using (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
  ) then
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_ppe_inventory_updated_at'
    ) then
      create trigger trg_ppe_inventory_updated_at
      before update on public.ppe_inventory
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (
      select 1 from pg_trigger where tgname = 'trg_ppe_assignments_updated_at'
    ) then
      create trigger trg_ppe_assignments_updated_at
      before update on public.ppe_assignments
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;
