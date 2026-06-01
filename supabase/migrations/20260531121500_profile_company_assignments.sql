alter table public.companies
  add column if not exists branch_name text,
  add column if not exists used_minutes integer not null default 0,
  add column if not exists employer_representative_name text,
  add column if not exists occupational_safety_specialist_name text,
  add column if not exists workplace_doctor_name text,
  add column if not exists employee_representative_name text,
  add column if not exists knowledgeable_employee_name text,
  add column if not exists fire_support_person_name text,
  add column if not exists first_aid_support_person_name text,
  add column if not exists evacuation_support_person_name text,
  add column if not exists visit_frequency text;

create table if not exists public.company_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid not null references public.companies(id) on delete cascade,
  assignment_group text not null default 'general',
  role_type text not null,
  person_name text,
  person_id uuid null,
  certificate_no text,
  phone text,
  email text,
  assigned_minutes integer,
  starts_at date,
  ends_at date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_assignments_company_id on public.company_assignments(company_id);
create index if not exists idx_company_assignments_user_id on public.company_assignments(user_id);
create index if not exists idx_company_assignments_org_id on public.company_assignments(organization_id);

alter table public.company_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_assignments'
      and policyname = 'Users manage own company assignments'
  ) then
    create policy "Users manage own company assignments"
      on public.company_assignments
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
