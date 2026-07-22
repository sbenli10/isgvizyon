create table if not exists public.training_attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  title text not null,
  training_type text not null default 'İlk eğitim',
  training_method text not null default 'Yüz yüze',
  training_date date null,
  duration_hours numeric not null default 0,
  location text not null default '',
  trainer_names text[] not null default '{}',
  description text not null default '',
  status text not null default 'Taslak',
  document_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendance_status_check check (status in ('Taslak', 'Kaydedildi', 'PDF hazır', 'Eksik bilgi var')),
  constraint training_attendance_duration_check check (duration_hours >= 0)
);

create table if not exists public.training_attendance_days (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.training_attendance_records(id) on delete cascade,
  day_number integer not null default 1,
  training_date date null,
  start_time time null,
  end_time time null,
  duration_minutes integer not null default 0,
  trainer_name text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendance_days_duration_check check (duration_minutes >= 0)
);

create table if not exists public.training_attendance_topics (
  id uuid primary key default gen_random_uuid(),
  training_day_id uuid not null references public.training_attendance_days(id) on delete cascade,
  category text not null default 'Diğer Konular',
  title text not null,
  duration_minutes integer not null default 0,
  trainer_name text not null default '',
  description text not null default '',
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendance_topics_duration_check check (duration_minutes >= 0)
);

create table if not exists public.training_attendance_participants (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.training_attendance_records(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  source text not null default 'Harici',
  full_name text not null,
  national_id text not null default '',
  job_title text not null default '',
  department text not null default '',
  phone text not null default '',
  email text not null default '',
  company_name text not null default '',
  attendance_status text not null default 'Katıldı',
  signature_status text not null default 'Bekliyor',
  certificate_status text not null default 'Bekliyor',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint training_attendance_participant_source_check check (source in ('Firma çalışanı', 'Harici', 'Excel')),
  constraint training_attendance_participant_attendance_check check (attendance_status in ('Katıldı', 'Katılmadı', 'Kısmi katılım', 'Mazeretli')),
  constraint training_attendance_participant_signature_check check (signature_status in ('Bekliyor', 'İmzalandı', 'Dijital onay', 'Uygulanamaz')),
  constraint training_attendance_participant_certificate_check check (certificate_status in ('Bekliyor', 'Oluşturuldu', 'Aktarıldı'))
);

create index if not exists idx_training_attendance_records_user
  on public.training_attendance_records(user_id, updated_at desc);

create index if not exists idx_training_attendance_records_org
  on public.training_attendance_records(organization_id, updated_at desc);

create index if not exists idx_training_attendance_records_company
  on public.training_attendance_records(company_id, training_date desc);

create index if not exists idx_training_attendance_days_training
  on public.training_attendance_days(training_id, sort_order);

create index if not exists idx_training_attendance_topics_day
  on public.training_attendance_topics(training_day_id, sort_order);

create index if not exists idx_training_attendance_participants_training
  on public.training_attendance_participants(training_id, sort_order);

create or replace function public.set_training_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_training_attendance_records_updated_at on public.training_attendance_records;
create trigger set_training_attendance_records_updated_at
before update on public.training_attendance_records
for each row execute function public.set_training_attendance_updated_at();

drop trigger if exists set_training_attendance_days_updated_at on public.training_attendance_days;
create trigger set_training_attendance_days_updated_at
before update on public.training_attendance_days
for each row execute function public.set_training_attendance_updated_at();

drop trigger if exists set_training_attendance_topics_updated_at on public.training_attendance_topics;
create trigger set_training_attendance_topics_updated_at
before update on public.training_attendance_topics
for each row execute function public.set_training_attendance_updated_at();

alter table public.training_attendance_records enable row level security;
alter table public.training_attendance_days enable row level security;
alter table public.training_attendance_topics enable row level security;
alter table public.training_attendance_participants enable row level security;

create policy "Training records are scoped to user or active workspace"
on public.training_attendance_records
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

create policy "Training days follow parent record scope"
on public.training_attendance_days
for all
to authenticated
using (
  exists (
    select 1 from public.training_attendance_records r
    where r.id = training_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1 from public.training_attendance_records r
    where r.id = training_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);

create policy "Training topics follow parent record scope"
on public.training_attendance_topics
for all
to authenticated
using (
  exists (
    select 1
    from public.training_attendance_days d
    join public.training_attendance_records r on r.id = d.training_id
    where d.id = training_day_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.training_attendance_days d
    join public.training_attendance_records r on r.id = d.training_id
    where d.id = training_day_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);

create policy "Training participants follow parent record scope"
on public.training_attendance_participants
for all
to authenticated
using (
  exists (
    select 1 from public.training_attendance_records r
    where r.id = training_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1 from public.training_attendance_records r
    where r.id = training_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);
