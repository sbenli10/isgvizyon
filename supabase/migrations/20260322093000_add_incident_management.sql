create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.isgkatip_companies(id) on delete set null,
  incident_type text not null check (incident_type in ('work_accident', 'near_miss')),
  title text not null,
  description text not null,
  incident_date timestamptz not null,
  location text,
  affected_person text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  root_cause text,
  immediate_action text,
  corrective_action text,
  status text not null default 'open' check (status in ('open', 'investigating', 'action_required', 'closed')),
  reported_by text,
  witness_info text,
  accident_category text,
  lost_time_days integer not null default 0,
  requires_notification boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_title text not null,
  owner_name text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incident_reports_user_date on public.incident_reports(user_id, incident_date desc);
create index if not exists idx_incident_reports_company_status on public.incident_reports(company_id, status);
create index if not exists idx_incident_reports_type_severity on public.incident_reports(incident_type, severity);
create index if not exists idx_incident_attachments_report on public.incident_attachments(report_id, created_at desc);
create index if not exists idx_incident_actions_report on public.incident_actions(report_id, due_date);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'incident_reports_lost_time_days_check'
  ) then
    alter table public.incident_reports
      add constraint incident_reports_lost_time_days_check
      check (lost_time_days >= 0);
  end if;
end $$;

alter table public.incident_reports enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.incident_actions enable row level security;

drop policy if exists "Users can view own incident reports" on public.incident_reports;
drop policy if exists "Users can insert own incident reports" on public.incident_reports;
drop policy if exists "Users can update own incident reports" on public.incident_reports;
drop policy if exists "Users can delete own incident reports" on public.incident_reports;

create policy "Users can view own incident reports"
on public.incident_reports
for select
using (auth.uid() = user_id);

create policy "Users can insert own incident reports"
on public.incident_reports
for insert
with check (auth.uid() = user_id);

create policy "Users can update own incident reports"
on public.incident_reports
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own incident reports"
on public.incident_reports
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own incident attachments" on public.incident_attachments;
drop policy if exists "Users can insert own incident attachments" on public.incident_attachments;
drop policy if exists "Users can delete own incident attachments" on public.incident_attachments;

create policy "Users can view own incident attachments"
on public.incident_attachments
for select
using (auth.uid() = user_id);

create policy "Users can insert own incident attachments"
on public.incident_attachments
for insert
with check (auth.uid() = user_id);

create policy "Users can delete own incident attachments"
on public.incident_attachments
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own incident actions" on public.incident_actions;
drop policy if exists "Users can insert own incident actions" on public.incident_actions;
drop policy if exists "Users can update own incident actions" on public.incident_actions;
drop policy if exists "Users can delete own incident actions" on public.incident_actions;

create policy "Users can view own incident actions"
on public.incident_actions
for select
using (auth.uid() = user_id);

create policy "Users can insert own incident actions"
on public.incident_actions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own incident actions"
on public.incident_actions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own incident actions"
on public.incident_actions
for delete
using (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_incident_reports_updated_at'
    ) then
      create trigger trg_incident_reports_updated_at
      before update on public.incident_reports
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_incident_actions_updated_at'
    ) then
      create trigger trg_incident_actions_updated_at
      before update on public.incident_actions
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('incident-files', 'incident-files', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read incident files" on storage.objects;
drop policy if exists "Authenticated users can upload incident files" on storage.objects;
drop policy if exists "Authenticated users can update incident files" on storage.objects;
drop policy if exists "Authenticated users can delete incident files" on storage.objects;

create policy "Authenticated users can read incident files"
on storage.objects
for select
using (
  bucket_id = 'incident-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can upload incident files"
on storage.objects
for insert
with check (
  bucket_id = 'incident-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can update incident files"
on storage.objects
for update
using (
  bucket_id = 'incident-files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'incident-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can delete incident files"
on storage.objects
for delete
using (
  bucket_id = 'incident-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);
