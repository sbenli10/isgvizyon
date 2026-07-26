create table if not exists public.orientation_training_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  training_date date not null default current_date,
  document_date date not null default current_date,
  duration_hours numeric not null default 2,
  training_place text not null default '',
  training_method text not null default 'Uygulamalı',
  trainer_name text not null default '',
  include_specialist_signature boolean not null default false,
  include_doctor_signature boolean not null default false,
  hide_national_id boolean not null default false,
  logo_data_url text null,
  notes text not null default '',
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orientation_training_status_check check (status in ('Taslak', 'Kaydedildi')),
  constraint orientation_training_duration_check check (duration_hours > 0)
);

create table if not exists public.orientation_training_participants (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.orientation_training_records(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  full_name text not null,
  national_id text not null default '',
  job_title text not null default '',
  department text not null default '',
  start_date date null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orientation_training_topics (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.orientation_training_records(id) on delete cascade,
  title text not null,
  is_selected boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_orientation_training_records_user
  on public.orientation_training_records(user_id, updated_at desc);

create index if not exists idx_orientation_training_records_org
  on public.orientation_training_records(organization_id, updated_at desc);

create index if not exists idx_orientation_training_records_company
  on public.orientation_training_records(company_id, training_date desc);

create index if not exists idx_orientation_training_participants_record
  on public.orientation_training_participants(record_id, sort_order);

create index if not exists idx_orientation_training_topics_record
  on public.orientation_training_topics(record_id, sort_order);

create or replace function public.set_orientation_training_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orientation_training_records_updated_at on public.orientation_training_records;
create trigger set_orientation_training_records_updated_at
before update on public.orientation_training_records
for each row execute function public.set_orientation_training_updated_at();

alter table public.orientation_training_records enable row level security;
alter table public.orientation_training_participants enable row level security;
alter table public.orientation_training_topics enable row level security;

create policy "Orientation training records are scoped to user or workspace"
on public.orientation_training_records
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

create policy "Orientation training participants follow parent record scope"
on public.orientation_training_participants
for all
to authenticated
using (
  exists (
    select 1 from public.orientation_training_records r
    where r.id = record_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1 from public.orientation_training_records r
    where r.id = record_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);

create policy "Orientation training topics follow parent record scope"
on public.orientation_training_topics
for all
to authenticated
using (
  exists (
    select 1 from public.orientation_training_records r
    where r.id = record_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1 from public.orientation_training_records r
    where r.id = record_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);
