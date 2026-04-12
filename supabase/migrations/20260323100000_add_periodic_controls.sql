create table if not exists public.periodic_controls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.isgkatip_companies(id) on delete set null,
  equipment_name text not null,
  control_category text not null,
  location text,
  responsible_vendor text,
  standard_reference text,
  last_control_date date,
  next_control_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'warning', 'overdue', 'completed', 'inactive')),
  result_status text not null default 'not_evaluated' check (result_status in ('suitable', 'conditional', 'unsuitable', 'not_evaluated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.periodic_control_reports (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.periodic_controls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  report_summary text,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_periodic_controls_user_next_date
  on public.periodic_controls(user_id, next_control_date);

create index if not exists idx_periodic_controls_company_status
  on public.periodic_controls(company_id, status);

create index if not exists idx_periodic_controls_category
  on public.periodic_controls(control_category);

create index if not exists idx_periodic_control_reports_control_date
  on public.periodic_control_reports(control_id, report_date desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'periodic_controls_next_control_date_check'
  ) then
    alter table public.periodic_controls
      add constraint periodic_controls_next_control_date_check
      check (last_control_date is null or next_control_date >= last_control_date);
  end if;
end $$;

alter table public.periodic_controls enable row level security;
alter table public.periodic_control_reports enable row level security;

drop policy if exists "Users can view own periodic controls" on public.periodic_controls;
drop policy if exists "Users can insert own periodic controls" on public.periodic_controls;
drop policy if exists "Users can update own periodic controls" on public.periodic_controls;
drop policy if exists "Users can delete own periodic controls" on public.periodic_controls;

create policy "Users can view own periodic controls"
on public.periodic_controls for select
using (auth.uid() = user_id);

create policy "Users can insert own periodic controls"
on public.periodic_controls for insert
with check (auth.uid() = user_id);

create policy "Users can update own periodic controls"
on public.periodic_controls for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own periodic controls"
on public.periodic_controls for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own periodic control reports" on public.periodic_control_reports;
drop policy if exists "Users can insert own periodic control reports" on public.periodic_control_reports;
drop policy if exists "Users can delete own periodic control reports" on public.periodic_control_reports;

create policy "Users can view own periodic control reports"
on public.periodic_control_reports for select
using (auth.uid() = user_id);

create policy "Users can insert own periodic control reports"
on public.periodic_control_reports for insert
with check (auth.uid() = user_id);

create policy "Users can delete own periodic control reports"
on public.periodic_control_reports for delete
using (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'update_updated_at_column'
  ) then
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_periodic_controls_updated_at'
    ) then
      create trigger trg_periodic_controls_updated_at
      before update on public.periodic_controls
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('periodic-control-files', 'periodic-control-files', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read periodic control files" on storage.objects;
drop policy if exists "Authenticated users can upload periodic control files" on storage.objects;
drop policy if exists "Authenticated users can update periodic control files" on storage.objects;
drop policy if exists "Authenticated users can delete periodic control files" on storage.objects;

create policy "Authenticated users can read periodic control files"
on storage.objects for select
using (
  bucket_id = 'periodic-control-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can upload periodic control files"
on storage.objects for insert
with check (
  bucket_id = 'periodic-control-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can update periodic control files"
on storage.objects for update
using (
  bucket_id = 'periodic-control-files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'periodic-control-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can delete periodic control files"
on storage.objects for delete
using (
  bucket_id = 'periodic-control-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);
