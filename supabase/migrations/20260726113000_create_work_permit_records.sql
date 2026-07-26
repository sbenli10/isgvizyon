create table if not exists public.work_permit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  contractor_name text not null default '',
  company_address text not null default '',
  workplace_registration_number text not null default '',
  hazard_class text not null default '',
  work_location text not null default '',
  work_detail text not null default '',
  start_date_time timestamptz null,
  end_date_time timestamptz null,
  permit_types jsonb not null default '[]'::jsonb,
  safety_checks jsonb not null default '[]'::jsonb,
  ppe_items jsonb not null default '[]'::jsonb,
  approvers jsonb not null default '[]'::jsonb,
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_permit_records_status_check
    check (status in ('Taslak', 'Onaylandı'))
);

alter table public.work_permit_records
  drop constraint if exists work_permit_records_status_check;

alter table public.work_permit_records
  add constraint work_permit_records_status_check
  check (status in ('Taslak', 'Onaylandı'));

create index if not exists idx_work_permit_records_user_updated
  on public.work_permit_records(user_id, updated_at desc);

create index if not exists idx_work_permit_records_company
  on public.work_permit_records(company_id, updated_at desc);

create index if not exists idx_work_permit_records_org
  on public.work_permit_records(organization_id, updated_at desc);

create or replace function public.set_work_permit_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_permit_records_updated_at on public.work_permit_records;
create trigger trg_work_permit_records_updated_at
before update on public.work_permit_records
for each row
execute function public.set_work_permit_records_updated_at();

alter table public.work_permit_records enable row level security;

drop policy if exists "Users can view work permit records" on public.work_permit_records;
create policy "Users can view work permit records"
on public.work_permit_records
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "Users can insert work permit records" on public.work_permit_records;
create policy "Users can insert work permit records"
on public.work_permit_records
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can update work permit records" on public.work_permit_records;
create policy "Users can update work permit records"
on public.work_permit_records
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can delete work permit records" on public.work_permit_records;
create policy "Users can delete work permit records"
on public.work_permit_records
for delete
to authenticated
using (
  user_id = auth.uid()
);
