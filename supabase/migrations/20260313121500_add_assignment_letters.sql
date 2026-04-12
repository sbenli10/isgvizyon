create table if not exists public.assignment_letters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('risk_assessment_team', 'support_staff', 'employee_representative')),
  start_date date not null,
  duration integer not null,
  weekly_hours numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_letters_company_id on public.assignment_letters(company_id);
create index if not exists idx_assignment_letters_employee_id on public.assignment_letters(employee_id);
create index if not exists idx_assignment_letters_created_at on public.assignment_letters(created_at desc);
