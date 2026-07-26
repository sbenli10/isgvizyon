create table if not exists public.incident_investigation_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  company_address text not null default '',
  workplace_registration_number text not null default '',
  hazard_class text not null default '',
  employer_name text not null default '',
  incident_date_time timestamptz null,
  incident_place text not null default '',
  injured_employee_name text not null default '',
  injured_employee_job_title text not null default '',
  injured_employee_seniority text not null default '',
  incident_summary text not null default '',
  five_why_answers jsonb not null default '[]'::jsonb,
  ishikawa jsonb not null default '{}'::jsonb,
  corrective_actions jsonb not null default '[]'::jsonb,
  evidence_photo_data_url text null,
  critical_notes text not null default '',
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_investigation_reports_status_check
    check (status in ('Taslak', 'Tamamlandı'))
);

alter table public.incident_investigation_reports
  drop constraint if exists incident_investigation_reports_status_check;

alter table public.incident_investigation_reports
  add constraint incident_investigation_reports_status_check
  check (status in ('Taslak', 'Tamamlandı'));

create index if not exists idx_incident_investigation_reports_user_updated
  on public.incident_investigation_reports(user_id, updated_at desc);

create index if not exists idx_incident_investigation_reports_company
  on public.incident_investigation_reports(company_id, updated_at desc);

create index if not exists idx_incident_investigation_reports_org
  on public.incident_investigation_reports(organization_id, updated_at desc);

create or replace function public.set_incident_investigation_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_incident_investigation_reports_updated_at on public.incident_investigation_reports;
create trigger trg_incident_investigation_reports_updated_at
before update on public.incident_investigation_reports
for each row
execute function public.set_incident_investigation_reports_updated_at();

alter table public.incident_investigation_reports enable row level security;

drop policy if exists "Users can view incident investigation reports" on public.incident_investigation_reports;
create policy "Users can view incident investigation reports"
on public.incident_investigation_reports
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "Users can insert incident investigation reports" on public.incident_investigation_reports;
create policy "Users can insert incident investigation reports"
on public.incident_investigation_reports
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can update incident investigation reports" on public.incident_investigation_reports;
create policy "Users can update incident investigation reports"
on public.incident_investigation_reports
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can delete incident investigation reports" on public.incident_investigation_reports;
create policy "Users can delete incident investigation reports"
on public.incident_investigation_reports
for delete
to authenticated
using (
  user_id = auth.uid()
);
