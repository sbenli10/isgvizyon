create table if not exists public.emergency_drill_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid null,
  company_name text not null default '',
  company_address text not null default '',
  workplace_registration_number text not null default '',
  hazard_class text not null default '',
  employer_name text not null default '',
  specialist_name text not null default '',
  drill_type text not null default 'Yangın Tatbikatı',
  drill_date date not null,
  drill_location text not null default '',
  start_time text not null default '',
  end_time text not null default '',
  duration_minutes integer not null default 0,
  is_planned boolean not null default true,
  is_announced boolean not null default true,
  coordinator_name text not null default '',
  scenario_text text not null default '',
  general_evaluation text not null default '',
  detected_deficiencies text not null default '',
  corrective_actions text not null default '',
  next_review_date date null,
  logo_data_url text null,
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_drill_reports_status_check check (status in ('Taslak', 'Kaydedildi')),
  constraint emergency_drill_reports_duration_check check (duration_minutes >= 0)
);

create table if not exists public.emergency_drill_report_teams (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.emergency_drill_reports(id) on delete cascade,
  employee_id uuid null,
  full_name text not null,
  team_role text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_drill_report_checklist (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.emergency_drill_reports(id) on delete cascade,
  question text not null,
  answer text not null default 'Evet',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint emergency_drill_report_checklist_answer_check check (answer in ('Evet', 'Hayır', 'Kısmen'))
);

create index if not exists idx_emergency_drill_reports_user
  on public.emergency_drill_reports(user_id, updated_at desc);

create index if not exists idx_emergency_drill_reports_org
  on public.emergency_drill_reports(organization_id, updated_at desc);

create index if not exists idx_emergency_drill_reports_company
  on public.emergency_drill_reports(company_id, drill_date desc);

create index if not exists idx_emergency_drill_report_teams_report
  on public.emergency_drill_report_teams(report_id, sort_order);

create index if not exists idx_emergency_drill_report_checklist_report
  on public.emergency_drill_report_checklist(report_id, sort_order);

create or replace function public.set_emergency_drill_report_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_emergency_drill_reports_updated_at on public.emergency_drill_reports;
create trigger set_emergency_drill_reports_updated_at
before update on public.emergency_drill_reports
for each row execute function public.set_emergency_drill_report_updated_at();

alter table public.emergency_drill_reports enable row level security;
alter table public.emergency_drill_report_teams enable row level security;
alter table public.emergency_drill_report_checklist enable row level security;

drop policy if exists "Users can manage own emergency drill reports" on public.emergency_drill_reports;
create policy "Users can manage own emergency drill reports"
on public.emergency_drill_reports
for all
using (
  user_id = auth.uid()
  or (
    organization_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = emergency_drill_reports.organization_id
        and om.user_id = auth.uid()
    )
  )
)
with check (
  user_id = auth.uid()
  or (
    organization_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = emergency_drill_reports.organization_id
        and om.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can manage own emergency drill report teams" on public.emergency_drill_report_teams;
create policy "Users can manage own emergency drill report teams"
on public.emergency_drill_report_teams
for all
using (
  exists (
    select 1 from public.emergency_drill_reports r
    where r.id = emergency_drill_report_teams.report_id
      and (
        r.user_id = auth.uid()
        or (
          r.organization_id is not null
          and exists (
            select 1 from public.organization_members om
            where om.organization_id = r.organization_id
              and om.user_id = auth.uid()
          )
        )
      )
  )
)
with check (
  exists (
    select 1 from public.emergency_drill_reports r
    where r.id = emergency_drill_report_teams.report_id
      and (
        r.user_id = auth.uid()
        or (
          r.organization_id is not null
          and exists (
            select 1 from public.organization_members om
            where om.organization_id = r.organization_id
              and om.user_id = auth.uid()
          )
        )
      )
  )
);

drop policy if exists "Users can manage own emergency drill report checklist" on public.emergency_drill_report_checklist;
create policy "Users can manage own emergency drill report checklist"
on public.emergency_drill_report_checklist
for all
using (
  exists (
    select 1 from public.emergency_drill_reports r
    where r.id = emergency_drill_report_checklist.report_id
      and (
        r.user_id = auth.uid()
        or (
          r.organization_id is not null
          and exists (
            select 1 from public.organization_members om
            where om.organization_id = r.organization_id
              and om.user_id = auth.uid()
          )
        )
      )
  )
)
with check (
  exists (
    select 1 from public.emergency_drill_reports r
    where r.id = emergency_drill_report_checklist.report_id
      and (
        r.user_id = auth.uid()
        or (
          r.organization_id is not null
          and exists (
            select 1 from public.organization_members om
            where om.organization_id = r.organization_id
              and om.user_id = auth.uid()
          )
        )
      )
  )
);
