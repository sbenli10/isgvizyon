create table if not exists public.osgb_finance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  invoice_no text,
  service_period text,
  invoice_date date,
  due_date date,
  amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz,
  payment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_document_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  document_type text not null,
  document_name text not null,
  issue_date date,
  expiry_date date,
  status text not null default 'active' check (status in ('active', 'warning', 'expired', 'archived')),
  file_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.isgkatip_companies(id) on delete set null,
  related_finance_id uuid references public.osgb_finance(id) on delete set null,
  related_document_id uuid references public.osgb_document_tracking(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to text,
  due_date date,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.isgkatip_companies(id) on delete cascade,
  title text,
  note text not null,
  note_type text not null default 'general' check (note_type in ('general', 'finance', 'document', 'assignment', 'risk')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_finance_user_company on public.osgb_finance(user_id, company_id);
create index if not exists idx_osgb_finance_status_due_date on public.osgb_finance(status, due_date);
create index if not exists idx_osgb_document_tracking_user_company on public.osgb_document_tracking(user_id, company_id);
create index if not exists idx_osgb_document_tracking_status_expiry on public.osgb_document_tracking(status, expiry_date);
create index if not exists idx_osgb_tasks_user_company on public.osgb_tasks(user_id, company_id);
create index if not exists idx_osgb_tasks_status_due_date on public.osgb_tasks(status, due_date);
create index if not exists idx_osgb_notes_user_company on public.osgb_notes(user_id, company_id);

alter table public.osgb_finance enable row level security;
alter table public.osgb_document_tracking enable row level security;
alter table public.osgb_tasks enable row level security;
alter table public.osgb_notes enable row level security;

drop policy if exists "Users can view own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can insert own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can update own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can delete own OSGB finance" on public.osgb_finance;

create policy "Users can view own OSGB finance"
on public.osgb_finance
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB finance"
on public.osgb_finance
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB finance"
on public.osgb_finance
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB finance"
on public.osgb_finance
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can insert own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can update own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can delete own OSGB documents" on public.osgb_document_tracking;

create policy "Users can view own OSGB documents"
on public.osgb_document_tracking
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB documents"
on public.osgb_document_tracking
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB documents"
on public.osgb_document_tracking
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB documents"
on public.osgb_document_tracking
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can insert own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can update own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can delete own OSGB tasks" on public.osgb_tasks;

create policy "Users can view own OSGB tasks"
on public.osgb_tasks
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB tasks"
on public.osgb_tasks
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB tasks"
on public.osgb_tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB tasks"
on public.osgb_tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can insert own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can update own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can delete own OSGB notes" on public.osgb_notes;

create policy "Users can view own OSGB notes"
on public.osgb_notes
for select
using (auth.uid() = user_id);

create policy "Users can insert own OSGB notes"
on public.osgb_notes
for insert
with check (auth.uid() = user_id);

create policy "Users can update own OSGB notes"
on public.osgb_notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own OSGB notes"
on public.osgb_notes
for delete
using (auth.uid() = user_id);
