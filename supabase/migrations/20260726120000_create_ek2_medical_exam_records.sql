create table if not exists public.ek2_medical_exam_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid null,
  employee_id uuid null,
  company_snapshot jsonb not null default '{}'::jsonb,
  employee_snapshot jsonb not null default '{}'::jsonb,
  workplace_declaration text null,
  birth_place text null,
  education text null,
  marital_status text null,
  children text null,
  previous_jobs jsonb not null default '[]'::jsonb,
  medical_history jsonb not null default '{}'::jsonb,
  family_history jsonb not null default '{}'::jsonb,
  anamnesis jsonb not null default '{}'::jsonb,
  anamnesis_notes jsonb not null default '{}'::jsonb,
  smoking_status text not null default 'no',
  smoking_details jsonb not null default '{}'::jsonb,
  alcohol_details jsonb not null default '{}'::jsonb,
  disability_details jsonb not null default '{}'::jsonb,
  physical_exam jsonb not null default '{}'::jsonb,
  vitals jsonb not null default '{}'::jsonb,
  laboratory jsonb not null default '{}'::jsonb,
  opinion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ek2_medical_exam_records
  add column if not exists anamnesis_notes jsonb not null default '{}'::jsonb,
  add column if not exists smoking_status text not null default 'no',
  add column if not exists smoking_details jsonb not null default '{}'::jsonb,
  add column if not exists alcohol_details jsonb not null default '{}'::jsonb,
  add column if not exists disability_details jsonb not null default '{}'::jsonb;

create index if not exists idx_ek2_medical_exam_records_user_updated
  on public.ek2_medical_exam_records(user_id, updated_at desc);

create index if not exists idx_ek2_medical_exam_records_company_updated
  on public.ek2_medical_exam_records(company_id, updated_at desc);

create index if not exists idx_ek2_medical_exam_records_employee_updated
  on public.ek2_medical_exam_records(employee_id, updated_at desc);

create or replace function public.set_ek2_medical_exam_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ek2_medical_exam_records_updated_at on public.ek2_medical_exam_records;
create trigger trg_ek2_medical_exam_records_updated_at
before update on public.ek2_medical_exam_records
for each row
execute function public.set_ek2_medical_exam_records_updated_at();

alter table public.ek2_medical_exam_records enable row level security;

drop policy if exists "Users can view ek2 medical exam records" on public.ek2_medical_exam_records;
create policy "Users can view ek2 medical exam records"
on public.ek2_medical_exam_records
for select
using (
  auth.uid() = user_id
);

drop policy if exists "Users can insert ek2 medical exam records" on public.ek2_medical_exam_records;
create policy "Users can insert ek2 medical exam records"
on public.ek2_medical_exam_records
for insert
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can update ek2 medical exam records" on public.ek2_medical_exam_records;
create policy "Users can update ek2 medical exam records"
on public.ek2_medical_exam_records
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can delete ek2 medical exam records" on public.ek2_medical_exam_records;
create policy "Users can delete ek2 medical exam records"
on public.ek2_medical_exam_records
for delete
using (
  auth.uid() = user_id
);
