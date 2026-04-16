do $$
begin
  if not exists (select 1 from pg_type where typname = 'osgb_team_role') then
    create type public.osgb_team_role as enum (
      'owner',
      'operations_manager',
      'secretary',
      'finance',
      'igu',
      'hekim',
      'dsp'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_contract_status') then
    create type public.osgb_contract_status as enum (
      'draft',
      'active',
      'paused',
      'expired',
      'terminated'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_visit_status') then
    create type public.osgb_visit_status as enum (
      'planned',
      'in_progress',
      'completed',
      'missed',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_evidence_type') then
    create type public.osgb_evidence_type as enum (
      'photo',
      'signature',
      'attendance_sheet',
      'meeting_minutes',
      'training_record',
      'gps',
      'document',
      'note'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_obligation_status') then
    create type public.osgb_obligation_status as enum (
      'compliant',
      'warning',
      'overdue',
      'missing',
      'not_applicable'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_finance_direction') then
    create type public.osgb_finance_direction as enum (
      'income',
      'expense'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_finance_kind') then
    create type public.osgb_finance_kind as enum (
      'accrual',
      'invoice',
      'collection',
      'refund',
      'salary_cost',
      'travel_cost',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'osgb_service_event_type') then
    create type public.osgb_service_event_type as enum (
      'onsite_visit',
      'board_meeting',
      'training',
      'risk_review',
      'emergency_drill',
      'health_surveillance',
      'periodic_control',
      'document_delivery',
      'remote_consulting'
    );
  end if;
end $$;

alter table if exists public.osgb_personnel
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists employment_start_date date,
  add column if not exists employment_end_date date,
  add column if not exists availability_status text not null default 'available',
  add column if not exists base_monthly_cost numeric(12,2) not null default 0,
  add column if not exists color_hex text;

alter table if exists public.osgb_assignments
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists service_month date,
  add column if not exists coverage_ratio numeric(6,2),
  add column if not exists legal_basis text;

alter table if exists public.osgb_finance
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists contract_id uuid,
  add column if not exists direction public.osgb_finance_direction not null default 'income',
  add column if not exists finance_kind public.osgb_finance_kind not null default 'invoice',
  add column if not exists accrual_month date,
  add column if not exists expected_collection_date date,
  add column if not exists profitability_tag text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table if exists public.osgb_document_tracking
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists legal_basis text,
  add column if not exists responsible_role public.osgb_team_role,
  add column if not exists reminder_days integer not null default 30,
  add column if not exists risk_if_missing text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table if exists public.osgb_tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists related_visit_id uuid,
  add column if not exists related_obligation_id uuid,
  add column if not exists assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table if exists public.osgb_notes
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists related_visit_id uuid;

create table if not exists public.osgb_batch_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  batch_type text not null,
  run_source text not null default 'cron',
  status text not null default 'success' check (status in ('success', 'error')),
  processed_count integer not null default 0,
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

alter table if exists public.osgb_batch_logs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.osgb_personnel p
set organization_id = pr.organization_id,
    profile_id = coalesce(p.profile_id, pr.id)
from public.profiles pr
where pr.id = p.user_id
  and p.organization_id is null;

update public.osgb_assignments a
set organization_id = coalesce(
      a.organization_id,
      (select c.org_id from public.isgkatip_companies c where c.id = a.company_id),
      (select pr.organization_id from public.profiles pr where pr.id = a.user_id)
    ),
    assigned_by = coalesce(
      a.assigned_by,
      (select pr.id from public.profiles pr where pr.id = a.user_id)
    ),
    legal_basis = coalesce(a.legal_basis, '6331 sayılı Kanun ve ilgili yönetmelikler')
where a.organization_id is null
   or a.assigned_by is null
   or a.legal_basis is null;

update public.osgb_finance f
set organization_id = coalesce(
      f.organization_id,
      (select c.org_id from public.isgkatip_companies c where c.id = f.company_id),
      (select pr.organization_id from public.profiles pr where pr.id = f.user_id)
    ),
    created_by = coalesce(
      f.created_by,
      (select pr.id from public.profiles pr where pr.id = f.user_id)
    )
where f.organization_id is null
   or f.created_by is null;

update public.osgb_document_tracking d
set organization_id = coalesce(
      d.organization_id,
      (select c.org_id from public.isgkatip_companies c where c.id = d.company_id),
      (select pr.organization_id from public.profiles pr where pr.id = d.user_id)
    ),
    created_by = coalesce(
      d.created_by,
      (select pr.id from public.profiles pr where pr.id = d.user_id)
    ),
    legal_basis = coalesce(d.legal_basis, 'İSG mevzuatı ve periyodik yenileme yükümlülükleri')
where d.organization_id is null
   or d.created_by is null
   or d.legal_basis is null;

update public.osgb_tasks t
set organization_id = coalesce(
      t.organization_id,
      (select c.org_id from public.isgkatip_companies c where c.id = t.company_id),
      (select pr.organization_id from public.profiles pr where pr.id = t.user_id)
    ),
    created_by = coalesce(
      t.created_by,
      (select pr.id from public.profiles pr where pr.id = t.user_id)
    ),
    assigned_profile_id = coalesce(
      t.assigned_profile_id,
      (
        select assignee.id
        from public.profiles assignee
        where assignee.full_name = t.assigned_to
          and assignee.organization_id = coalesce(
            (select c.org_id from public.isgkatip_companies c where c.id = t.company_id),
            (select pr.organization_id from public.profiles pr where pr.id = t.user_id)
          )
        order by assignee.created_at asc
        limit 1
      )
    )
where t.organization_id is null
   or t.created_by is null
   or (t.assigned_profile_id is null and t.assigned_to is not null);

update public.osgb_notes n
set organization_id = coalesce(
      n.organization_id,
      (select c.org_id from public.isgkatip_companies c where c.id = n.company_id),
      (select pr.organization_id from public.profiles pr where pr.id = n.user_id)
    ),
    created_by = coalesce(
      n.created_by,
      (select pr.id from public.profiles pr where pr.id = n.user_id)
    )
where n.organization_id is null
   or n.created_by is null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_batch_logs'
  ) then
    update public.osgb_batch_logs bl
    set organization_id = pr.organization_id
    from public.profiles pr
    where pr.id = bl.user_id
      and bl.organization_id is null;
  end if;
end $$;

create index if not exists idx_osgb_personnel_org_role on public.osgb_personnel(organization_id, role, is_active);
create index if not exists idx_osgb_assignments_org_company_role on public.osgb_assignments(organization_id, company_id, assigned_role, status);
create index if not exists idx_osgb_finance_org_company_status on public.osgb_finance(organization_id, company_id, status, due_date);
create index if not exists idx_osgb_documents_org_company_status on public.osgb_document_tracking(organization_id, company_id, status, expiry_date);
create index if not exists idx_osgb_tasks_org_status_due on public.osgb_tasks(organization_id, status, due_date);
create index if not exists idx_osgb_notes_org_company_created on public.osgb_notes(organization_id, company_id, created_at desc);
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_batch_logs'
  ) then
    create index if not exists idx_osgb_batch_logs_org_created on public.osgb_batch_logs(organization_id, created_at desc);
  end if;
end $$;

drop index if exists idx_osgb_assignments_one_active_company;
create unique index if not exists idx_osgb_assignments_active_person_company_role
  on public.osgb_assignments(organization_id, company_id, personnel_id, assigned_role)
  where status = 'active';

create table if not exists public.osgb_service_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  contract_no text,
  package_name text not null,
  contract_status public.osgb_contract_status not null default 'draft',
  starts_on date not null,
  ends_on date,
  billing_day integer,
  monthly_fee numeric(12,2) not null default 0,
  annual_fee numeric(12,2),
  currency text not null default 'TRY',
  auto_invoice boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_contract_service_lines (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.osgb_service_contracts(id) on delete cascade,
  service_role public.osgb_team_role not null,
  monthly_required_minutes integer not null default 0,
  monthly_planned_visits integer not null default 0,
  remote_support_minutes integer not null default 0,
  on_site_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.osgb_field_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  contract_id uuid references public.osgb_service_contracts(id) on delete set null,
  visit_type public.osgb_service_event_type not null,
  visit_status public.osgb_visit_status not null default 'planned',
  planned_start_at timestamptz not null,
  planned_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  route_order integer,
  visit_address text,
  coordinator_profile_id uuid references public.profiles(id) on delete set null,
  check_in_lat numeric(10,7),
  check_in_lng numeric(10,7),
  check_out_lat numeric(10,7),
  check_out_lng numeric(10,7),
  service_summary text,
  next_action_summary text,
  requires_client_signature boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_visit_personnel (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.osgb_field_visits(id) on delete cascade,
  personnel_id uuid references public.osgb_personnel(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  planned_role public.osgb_team_role not null,
  attended boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.osgb_visit_evidence (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.osgb_field_visits(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_type public.osgb_evidence_type not null,
  title text not null,
  file_url text,
  payload jsonb not null default '{}'::jsonb,
  captured_by uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default now()
);

create table if not exists public.osgb_obligation_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  obligation_name text not null,
  category text not null,
  hazard_classes text[] not null default '{}',
  minimum_employee_count integer,
  maximum_employee_count integer,
  legal_basis text not null,
  default_validity_days integer,
  default_reminder_days integer not null default 30,
  suggested_visit_type public.osgb_service_event_type,
  description text,
  risk_if_missing text,
  created_at timestamptz not null default now()
);

create table if not exists public.osgb_company_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  obligation_catalog_id uuid references public.osgb_obligation_catalog(id) on delete set null,
  source_document_id uuid references public.osgb_document_tracking(id) on delete set null,
  obligation_name text not null,
  obligation_status public.osgb_obligation_status not null default 'missing',
  legal_basis text not null,
  due_date date,
  last_completed_at date,
  next_required_at date,
  reminder_days integer not null default 30,
  risk_if_missing text,
  auto_generated boolean not null default true,
  responsible_role public.osgb_team_role,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.osgb_monthly_company_compliance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  service_month date not null,
  employee_count integer not null default 0,
  hazard_class text not null,
  igu_required_minutes integer not null default 0,
  hekim_required_minutes integer not null default 0,
  dsp_required_minutes integer not null default 0,
  igu_assigned_minutes integer not null default 0,
  hekim_assigned_minutes integer not null default 0,
  dsp_assigned_minutes integer not null default 0,
  deficit_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  compliance_status public.osgb_obligation_status not null default 'missing',
  generated_at timestamptz not null default now(),
  unique (organization_id, company_id, service_month)
);

create table if not exists public.osgb_finance_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  contract_id uuid references public.osgb_service_contracts(id) on delete set null,
  current_balance numeric(12,2) not null default 0,
  overdue_balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2),
  payment_term_days integer,
  collection_risk_score integer not null default 0,
  profitability_score integer not null default 0,
  last_invoice_date date,
  last_collection_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id)
);

create index if not exists idx_osgb_contracts_org_company on public.osgb_service_contracts(organization_id, company_id, contract_status);
create index if not exists idx_osgb_contract_lines_contract on public.osgb_contract_service_lines(contract_id, service_role);
create index if not exists idx_osgb_field_visits_org_date on public.osgb_field_visits(organization_id, planned_start_at desc);
create index if not exists idx_osgb_field_visits_company_status on public.osgb_field_visits(company_id, visit_status, planned_start_at);
create index if not exists idx_osgb_visit_evidence_visit_type on public.osgb_visit_evidence(visit_id, evidence_type, captured_at desc);
create index if not exists idx_osgb_obligation_catalog_category on public.osgb_obligation_catalog(category, code);
create index if not exists idx_osgb_company_obligations_org_status on public.osgb_company_obligations(organization_id, obligation_status, due_date);
create index if not exists idx_osgb_company_obligations_company on public.osgb_company_obligations(company_id, obligation_status, due_date);
create index if not exists idx_osgb_monthly_compliance_org_month on public.osgb_monthly_company_compliance(organization_id, service_month, compliance_status);
create index if not exists idx_osgb_finance_accounts_org_company on public.osgb_finance_accounts(organization_id, company_id);

create or replace function public.is_osgb_org_member(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = _organization_id
      and coalesce(p.is_active, true) = true
  );
$$;

create or replace function public.is_osgb_org_role(_organization_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = _organization_id
      and lower(coalesce(p.role, '')) = any (
        select lower(value)
        from unnest(_roles) as value
      )
  );
$$;

create or replace function public.osgb_apply_default_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if found then
    if new.organization_id is null then
      new.organization_id := v_profile.organization_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_osgb_personnel_apply_scope on public.osgb_personnel;
create trigger trg_osgb_personnel_apply_scope
before insert on public.osgb_personnel
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_assignments_apply_scope on public.osgb_assignments;
create trigger trg_osgb_assignments_apply_scope
before insert on public.osgb_assignments
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_finance_apply_scope on public.osgb_finance;
create trigger trg_osgb_finance_apply_scope
before insert on public.osgb_finance
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_documents_apply_scope on public.osgb_document_tracking;
create trigger trg_osgb_documents_apply_scope
before insert on public.osgb_document_tracking
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_tasks_apply_scope on public.osgb_tasks;
create trigger trg_osgb_tasks_apply_scope
before insert on public.osgb_tasks
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_notes_apply_scope on public.osgb_notes;
create trigger trg_osgb_notes_apply_scope
before insert on public.osgb_notes
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_visits_apply_scope on public.osgb_field_visits;
create trigger trg_osgb_visits_apply_scope
before insert on public.osgb_field_visits
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_company_obligations_apply_scope on public.osgb_company_obligations;
create trigger trg_osgb_company_obligations_apply_scope
before insert on public.osgb_company_obligations
for each row
execute function public.osgb_apply_default_scope();

drop trigger if exists trg_osgb_finance_accounts_apply_scope on public.osgb_finance_accounts;
create trigger trg_osgb_finance_accounts_apply_scope
before insert on public.osgb_finance_accounts
for each row
execute function public.osgb_apply_default_scope();

alter table public.osgb_personnel enable row level security;
alter table public.osgb_assignments enable row level security;
alter table public.osgb_finance enable row level security;
alter table public.osgb_document_tracking enable row level security;
alter table public.osgb_tasks enable row level security;
alter table public.osgb_notes enable row level security;
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_batch_logs'
  ) then
    alter table public.osgb_batch_logs enable row level security;
  end if;
end $$;
alter table public.osgb_service_contracts enable row level security;
alter table public.osgb_contract_service_lines enable row level security;
alter table public.osgb_field_visits enable row level security;
alter table public.osgb_visit_personnel enable row level security;
alter table public.osgb_visit_evidence enable row level security;
alter table public.osgb_obligation_catalog enable row level security;
alter table public.osgb_company_obligations enable row level security;
alter table public.osgb_monthly_company_compliance enable row level security;
alter table public.osgb_finance_accounts enable row level security;

drop policy if exists "Users can view own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can insert own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can update own OSGB personnel" on public.osgb_personnel;
drop policy if exists "Users can delete own OSGB personnel" on public.osgb_personnel;

create policy "Organization members can view OSGB personnel"
on public.osgb_personnel
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage OSGB personnel"
on public.osgb_personnel
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']));

drop policy if exists "Users can view own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can insert own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can update own OSGB assignments" on public.osgb_assignments;
drop policy if exists "Users can delete own OSGB assignments" on public.osgb_assignments;

create policy "Organization members can view OSGB assignments"
on public.osgb_assignments
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage OSGB assignments"
on public.osgb_assignments
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']));

drop policy if exists "Users can view own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can insert own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can update own OSGB finance" on public.osgb_finance;
drop policy if exists "Users can delete own OSGB finance" on public.osgb_finance;

create policy "Organization members can view OSGB finance"
on public.osgb_finance
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Finance roles can manage OSGB finance"
on public.osgb_finance
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager']));

drop policy if exists "Users can view own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can insert own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can update own OSGB documents" on public.osgb_document_tracking;
drop policy if exists "Users can delete own OSGB documents" on public.osgb_document_tracking;

create policy "Organization members can view OSGB documents"
on public.osgb_document_tracking
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage OSGB documents"
on public.osgb_document_tracking
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']));

drop policy if exists "Users can view own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can insert own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can update own OSGB tasks" on public.osgb_tasks;
drop policy if exists "Users can delete own OSGB tasks" on public.osgb_tasks;

create policy "Organization members can view OSGB tasks"
on public.osgb_tasks
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage OSGB tasks"
on public.osgb_tasks
for all to authenticated
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));

drop policy if exists "Users can view own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can insert own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can update own OSGB notes" on public.osgb_notes;
drop policy if exists "Users can delete own OSGB notes" on public.osgb_notes;

create policy "Organization members can view OSGB notes"
on public.osgb_notes
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage OSGB notes"
on public.osgb_notes
for all to authenticated
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_batch_logs'
  ) then
    drop policy if exists "Users can view own OSGB batch logs" on public.osgb_batch_logs;
    drop policy if exists "Organization members can view OSGB batch logs" on public.osgb_batch_logs;
    create policy "Organization members can view OSGB batch logs"
    on public.osgb_batch_logs
    for select to authenticated
    using (organization_id is null or public.is_osgb_org_member(organization_id));
  end if;
end $$;

drop policy if exists "Organization members can view service contracts" on public.osgb_service_contracts;
drop policy if exists "Organization operators can manage service contracts" on public.osgb_service_contracts;
create policy "Organization members can view service contracts"
on public.osgb_service_contracts
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage service contracts"
on public.osgb_service_contracts
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'finance']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'finance']));

drop policy if exists "Organization members can view contract lines" on public.osgb_contract_service_lines;
drop policy if exists "Organization operators can manage contract lines" on public.osgb_contract_service_lines;
create policy "Organization members can view contract lines"
on public.osgb_contract_service_lines
for select to authenticated
using (
  exists (
    select 1
    from public.osgb_service_contracts c
    where c.id = contract_id
      and public.is_osgb_org_member(c.organization_id)
  )
);

create policy "Organization operators can manage contract lines"
on public.osgb_contract_service_lines
for all to authenticated
using (
  exists (
    select 1
    from public.osgb_service_contracts c
    where c.id = contract_id
      and public.is_osgb_org_role(c.organization_id, array['owner', 'admin', 'operations_manager', 'finance'])
  )
)
with check (
  exists (
    select 1
    from public.osgb_service_contracts c
    where c.id = contract_id
      and public.is_osgb_org_role(c.organization_id, array['owner', 'admin', 'operations_manager', 'finance'])
  )
);

drop policy if exists "Organization members can view field visits" on public.osgb_field_visits;
drop policy if exists "Organization members can manage field visits" on public.osgb_field_visits;
create policy "Organization members can view field visits"
on public.osgb_field_visits
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage field visits"
on public.osgb_field_visits
for all to authenticated
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));

drop policy if exists "Organization members can view visit personnel" on public.osgb_visit_personnel;
drop policy if exists "Organization members can manage visit personnel" on public.osgb_visit_personnel;
create policy "Organization members can view visit personnel"
on public.osgb_visit_personnel
for select to authenticated
using (
  exists (
    select 1
    from public.osgb_field_visits v
    where v.id = visit_id
      and public.is_osgb_org_member(v.organization_id)
  )
);

create policy "Organization members can manage visit personnel"
on public.osgb_visit_personnel
for all to authenticated
using (
  exists (
    select 1
    from public.osgb_field_visits v
    where v.id = visit_id
      and public.is_osgb_org_member(v.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.osgb_field_visits v
    where v.id = visit_id
      and public.is_osgb_org_member(v.organization_id)
  )
);

drop policy if exists "Organization members can view visit evidence" on public.osgb_visit_evidence;
drop policy if exists "Organization members can manage visit evidence" on public.osgb_visit_evidence;
create policy "Organization members can view visit evidence"
on public.osgb_visit_evidence
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization members can manage visit evidence"
on public.osgb_visit_evidence
for all to authenticated
using (public.is_osgb_org_member(organization_id))
with check (public.is_osgb_org_member(organization_id));

drop policy if exists "Authenticated users can view obligation catalog" on public.osgb_obligation_catalog;
create policy "Authenticated users can view obligation catalog"
on public.osgb_obligation_catalog
for select to authenticated
using (true);

drop policy if exists "Organization members can view company obligations" on public.osgb_company_obligations;
drop policy if exists "Organization operators can manage company obligations" on public.osgb_company_obligations;
create policy "Organization members can view company obligations"
on public.osgb_company_obligations
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage company obligations"
on public.osgb_company_obligations
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager', 'secretary']));

drop policy if exists "Organization members can view monthly compliance" on public.osgb_monthly_company_compliance;
drop policy if exists "Organization operators can manage monthly compliance" on public.osgb_monthly_company_compliance;
create policy "Organization members can view monthly compliance"
on public.osgb_monthly_company_compliance
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Organization operators can manage monthly compliance"
on public.osgb_monthly_company_compliance
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']));

drop policy if exists "Organization members can view finance accounts" on public.osgb_finance_accounts;
drop policy if exists "Finance roles can manage finance accounts" on public.osgb_finance_accounts;
create policy "Organization members can view finance accounts"
on public.osgb_finance_accounts
for select to authenticated
using (public.is_osgb_org_member(organization_id));

create policy "Finance roles can manage finance accounts"
on public.osgb_finance_accounts
for all to authenticated
using (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager']))
with check (public.is_osgb_org_role(organization_id, array['owner', 'admin', 'finance', 'operations_manager']));

create or replace function public.calculate_osgb_required_minutes(
  p_employee_count integer,
  p_hazard_class text,
  p_role text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_hazard text := lower(coalesce(p_hazard_class, ''));
  v_per_employee integer := 0;
begin
  if lower(coalesce(p_role, '')) = 'igu' then
    v_per_employee := case
      when v_hazard like '%çok%' or v_hazard like '%cok%' then 40
      when v_hazard like '%tehlikeli%' then 20
      else 10
    end;
  elsif lower(coalesce(p_role, '')) = 'hekim' then
    v_per_employee := case
      when v_hazard like '%çok%' or v_hazard like '%cok%' then 15
      when v_hazard like '%tehlikeli%' then 10
      else 5
    end;
  elsif lower(coalesce(p_role, '')) = 'dsp' then
    v_per_employee := case
      when v_hazard like '%çok%' or v_hazard like '%cok%' then 15
      when v_hazard like '%tehlikeli%' then 10
      else 0
    end;
  end if;

  return greatest(coalesce(p_employee_count, 0), 0) * v_per_employee;
end;
$$;

create or replace function public.refresh_osgb_monthly_compliance(
  p_organization_id uuid,
  p_service_month date default date_trunc('month', now())::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', coalesce(p_service_month, now()))::date;
  v_count integer := 0;
begin
  if p_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  delete from public.osgb_monthly_company_compliance
  where organization_id = p_organization_id
    and service_month = v_month;

  insert into public.osgb_monthly_company_compliance (
    organization_id,
    company_id,
    service_month,
    employee_count,
    hazard_class,
    igu_required_minutes,
    hekim_required_minutes,
    dsp_required_minutes,
    igu_assigned_minutes,
    hekim_assigned_minutes,
    dsp_assigned_minutes,
    deficit_minutes,
    overtime_minutes,
    compliance_status
  )
  select
    c.org_id,
    c.id,
    v_month,
    coalesce(c.employee_count, 0),
    coalesce(c.hazard_class, 'Bilinmiyor'),
    public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'igu'),
    public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'hekim'),
    public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'dsp'),
    coalesce(sum(case when a.assigned_role = 'igu' and a.status = 'active' then a.assigned_minutes else 0 end), 0),
    coalesce(sum(case when a.assigned_role = 'hekim' and a.status = 'active' then a.assigned_minutes else 0 end), 0),
    coalesce(sum(case when a.assigned_role = 'dsp' and a.status = 'active' then a.assigned_minutes else 0 end), 0),
    greatest(
      0,
      public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'igu')
        + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'hekim')
        + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'dsp')
        - coalesce(sum(case when a.status = 'active' then a.assigned_minutes else 0 end), 0)
    ),
    greatest(
      0,
      coalesce(sum(case when a.status = 'active' then a.assigned_minutes else 0 end), 0)
        - (
          public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'igu')
          + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'hekim')
          + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'dsp')
        )
    ),
    case
      when coalesce(sum(case when a.status = 'active' then a.assigned_minutes else 0 end), 0) = 0 then 'missing'::public.osgb_obligation_status
      when coalesce(sum(case when a.status = 'active' then a.assigned_minutes else 0 end), 0)
        < (
          public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'igu')
          + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'hekim')
          + public.calculate_osgb_required_minutes(c.employee_count, c.hazard_class, 'dsp')
        ) then 'overdue'::public.osgb_obligation_status
      else 'compliant'::public.osgb_obligation_status
    end
  from public.isgkatip_companies c
  left join public.osgb_assignments a
    on a.organization_id = c.org_id
   and a.company_id = c.id
   and a.status = 'active'
   and (a.service_month is null or date_trunc('month', a.service_month)::date = v_month)
  where c.org_id = p_organization_id
    and coalesce(c.is_deleted, false) = false
  group by c.org_id, c.id, c.employee_count, c.hazard_class;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace view public.v_osgb_company_profitability as
select
  fa.organization_id,
  fa.company_id,
  company.company_name,
  coalesce(contract.package_name, 'Tanımsız paket') as package_name,
  coalesce(contract.monthly_fee, 0) as monthly_fee,
  fa.current_balance,
  fa.overdue_balance,
  fa.collection_risk_score,
  fa.profitability_score,
  coalesce(compliance.deficit_minutes, 0) as deficit_minutes,
  coalesce(compliance.overtime_minutes, 0) as overtime_minutes,
  compliance.compliance_status,
  (
    coalesce(contract.monthly_fee, 0)
    - coalesce(personnel_cost.monthly_personnel_cost, 0)
    - coalesce(travel_cost.travel_cost, 0)
  ) as estimated_monthly_margin
from public.osgb_finance_accounts fa
join public.isgkatip_companies company on company.id = fa.company_id
left join lateral (
  select c.*
  from public.osgb_service_contracts c
  where c.company_id = fa.company_id
    and c.organization_id = fa.organization_id
    and c.contract_status = 'active'
  order by c.created_at desc
  limit 1
) contract on true
left join lateral (
  select *
  from public.osgb_monthly_company_compliance mc
  where mc.company_id = fa.company_id
    and mc.organization_id = fa.organization_id
    and mc.service_month = date_trunc('month', now())::date
  limit 1
) compliance on true
left join lateral (
  select coalesce(sum(p.base_monthly_cost), 0) as monthly_personnel_cost
  from public.osgb_assignments a
  join public.osgb_personnel p on p.id = a.personnel_id
  where a.company_id = fa.company_id
    and a.organization_id = fa.organization_id
    and a.status = 'active'
) personnel_cost on true
left join lateral (
  select coalesce(sum(case when f.direction = 'expense' and f.finance_kind = 'travel_cost' then f.amount else 0 end), 0) as travel_cost
  from public.osgb_finance f
  where f.company_id = fa.company_id
    and f.organization_id = fa.organization_id
) travel_cost on true;

insert into public.osgb_obligation_catalog (
  code,
  obligation_name,
  category,
  hazard_classes,
  legal_basis,
  default_validity_days,
  default_reminder_days,
  suggested_visit_type,
  description,
  risk_if_missing
)
values
  (
    'risk_assessment',
    'Risk değerlendirmesi güncelliği',
    'risk',
    array['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'],
    '6331 sayılı Kanun ve Risk Değerlendirmesi Yönetmeliği',
    730,
    45,
    'risk_review',
    'İşyerinin risk değerlendirmesinin güncel tutulması gerekir.',
    'Denetim uygunsuzluğu, idari yaptırım ve sahada kontrol kaybı doğurur.'
  ),
  (
    'emergency_plan',
    'Acil durum planı ve ekip organizasyonu',
    'emergency',
    array['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'],
    'İşyerlerinde Acil Durumlar Hakkında Yönetmelik',
    365,
    30,
    'emergency_drill',
    'Acil durum planı, ekip listeleri ve tatbikat kanıtları izlenir.',
    'Tahliye, yangın ve acil durumlarda organizasyon eksik kalır.'
  ),
  (
    'board_minutes',
    'İSG kurul toplantı tutanakları',
    'board',
    array['Tehlikeli', 'Çok Tehlikeli'],
    'İSG Kurulları Hakkında Yönetmelik',
    30,
    7,
    'board_meeting',
    'İSG kurul toplantı gündemi, katılımı ve tutanakları takip edilir.',
    'Kurul yükümlülüğü yerine getirilmez, karar ve aksiyon izi kaybolur.'
  ),
  (
    'annual_training_plan',
    'Yıllık eğitim planı ve katılım kayıtları',
    'training',
    array['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'],
    'Çalışanların İSG Eğitimleri Yönetmeliği',
    365,
    30,
    'training',
    'Yıllık plan, eğitim uygulaması ve katılım listeleri birlikte izlenir.',
    'Eğitim eksikliği idari risk ve kaza sonrası savunmasızlık doğurur.'
  ),
  (
    'periodic_controls',
    'Periyodik kontrol ve ölçüm planı',
    'inspection',
    array['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'],
    'İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği',
    365,
    30,
    'periodic_control',
    'Basınçlı kap, kaldırma ekipmanı ve benzeri periyodik kontroller takip edilir.',
    'Ekipman güvenliği düşer, denetim ve iş kazası riski yükselir.'
  )
on conflict (code) do nothing;

grant execute on function public.is_osgb_org_member(uuid) to authenticated;
grant execute on function public.is_osgb_org_role(uuid, text[]) to authenticated;
grant execute on function public.calculate_osgb_required_minutes(integer, text, text) to authenticated;
grant execute on function public.refresh_osgb_monthly_compliance(uuid, date) to authenticated;

grant select on public.v_osgb_company_profitability to authenticated;
