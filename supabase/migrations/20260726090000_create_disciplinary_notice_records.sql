create table if not exists public.disciplinary_notice_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  company_address text not null default '',
  workplace_registration_number text not null default '',
  hazard_class text not null default '',
  employer_name text not null default '',
  employee_id uuid null,
  employee_name text not null default '',
  employee_national_id text not null default '',
  employee_job_title text not null default '',
  employee_department text not null default '',
  employee_start_date date null,
  notice_date date not null default current_date,
  incident_date date not null default current_date,
  incident_time text not null default '',
  incident_place text not null default '',
  incident_description text not null default '',
  employee_defense text not null default '',
  violation_type text not null default 'Kuralsız Çalışma',
  penalty_type text not null default 'Yazılı İhtar',
  penalty_note text not null default '',
  selected_rules jsonb not null default '[]'::jsonb,
  witnesses jsonb not null default '[]'::jsonb,
  delivery_date date not null default current_date,
  delivery_status text not null default 'İmzalandı / Teslim aldı',
  logo_data_url text null,
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disciplinary_notice_status_check check (status in ('Taslak', 'Kaydedildi')),
  constraint disciplinary_notice_delivery_status_check check (delivery_status in ('İmzalandı / Teslim aldı', 'İmzadan imtina etti', 'Tebliğ edilemedi'))
);

create index if not exists idx_disciplinary_notice_records_user
  on public.disciplinary_notice_records(user_id, updated_at desc);

create index if not exists idx_disciplinary_notice_records_org
  on public.disciplinary_notice_records(organization_id, updated_at desc);

create index if not exists idx_disciplinary_notice_records_company
  on public.disciplinary_notice_records(company_id, notice_date desc);

create or replace function public.set_disciplinary_notice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_disciplinary_notice_records_updated_at on public.disciplinary_notice_records;
create trigger set_disciplinary_notice_records_updated_at
before update on public.disciplinary_notice_records
for each row execute function public.set_disciplinary_notice_updated_at();

alter table public.disciplinary_notice_records enable row level security;

create policy "Disciplinary notice records are scoped to user or active workspace"
on public.disciplinary_notice_records
for all
to authenticated
using (
  user_id = auth.uid()
  or (
    organization_id is not null
    and public.is_organization_member(organization_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);
