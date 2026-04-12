create table if not exists public.osgb_personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('igu', 'hekim', 'dsp')),
  certificate_no text,
  phone text,
  email text,
  monthly_capacity_minutes integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  personnel_id uuid not null references public.osgb_personnel(id) on delete cascade,
  assigned_role text not null check (assigned_role in ('igu', 'hekim', 'dsp')),
  assigned_minutes integer not null default 0,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'passive', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_personnel_user_role on public.osgb_personnel(user_id, role);
create index if not exists idx_osgb_assignments_user_company on public.osgb_assignments(user_id, company_id);
create index if not exists idx_osgb_assignments_personnel_status on public.osgb_assignments(personnel_id, status);

create unique index if not exists idx_osgb_assignments_one_active_company
  on public.osgb_assignments(user_id, company_id)
  where status = 'active';

alter table public.osgb_personnel enable row level security;
alter table public.osgb_assignments enable row level security;

drop policy if exists "Users can view own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can insert own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can update own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can delete own OSGB personnel" on public.osgb_personnel;

create policy "Users can view own OSGB personnel"
on public.osgb_personnel
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB personnel"
on public.osgb_personnel
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB personnel"
on public.osgb_personnel
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB personnel"
on public.osgb_personnel
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can insert own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can update own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can delete own OSGB assignments" on public.osgb_assignments;

create policy "Users can view own OSGB assignments"
on public.osgb_assignments
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB assignments"
on public.osgb_assignments
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB assignments"
on public.osgb_assignments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB assignments"
on public.osgb_assignments
for delete
using (auth.uid() = user_id);
