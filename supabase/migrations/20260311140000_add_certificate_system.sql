create extension if not exists pgcrypto;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  training_name text not null,
  training_date date not null,
  training_duration text not null,
  certificate_type text not null default 'Katilim',
  validity_date date,
  logo_url text,
  template_type text not null default 'classic',
  company_name text,
  company_address text,
  company_phone text,
  trainer_names text[] not null default '{}',
  frame_style text not null default 'gold',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_participants (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  name text not null,
  tc_no text,
  job_title text,
  certificate_no text,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_jobs (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  status text not null default 'draft',
  progress numeric(5,2) not null default 0,
  total_files integer not null default 0,
  completed_files integer not null default 0,
  zip_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.certificate_jobs(id) on delete cascade,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  participant_id uuid not null references public.certificate_participants(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  worker_id text,
  pdf_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, participant_id)
);

create index if not exists certificates_created_by_idx on public.certificates(created_by, created_at desc);
create index if not exists certificate_participants_certificate_idx on public.certificate_participants(certificate_id);
create index if not exists certificate_jobs_certificate_idx on public.certificate_jobs(certificate_id, created_at desc);
create index if not exists certificate_job_items_job_status_idx on public.certificate_job_items(job_id, status, created_at);

alter table public.certificates enable row level security;
alter table public.certificate_participants enable row level security;
alter table public.certificate_jobs enable row level security;
alter table public.certificate_job_items enable row level security;

drop policy if exists "Users can manage own certificates" on public.certificates;
create policy "Users can manage own certificates"
  on public.certificates
  for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Users can manage own certificate participants" on public.certificate_participants;
create policy "Users can manage own certificate participants"
  on public.certificate_participants
  for all
  using (
    exists (
      select 1
      from public.certificates c
      where c.id = certificate_participants.certificate_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.certificates c
      where c.id = certificate_participants.certificate_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "Users can manage own certificate jobs" on public.certificate_jobs;
create policy "Users can manage own certificate jobs"
  on public.certificate_jobs
  for all
  using (
    exists (
      select 1
      from public.certificates c
      where c.id = certificate_jobs.certificate_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.certificates c
      where c.id = certificate_jobs.certificate_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "Users can view own certificate job items" on public.certificate_job_items;
create policy "Users can view own certificate job items"
  on public.certificate_job_items
  for select
  using (
    exists (
      select 1
      from public.certificates c
      where c.id = certificate_job_items.certificate_id
        and c.created_by = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('certificate-files', 'certificate-files', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read certificate files" on storage.objects;
create policy "Authenticated users can read certificate files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'certificate-files');

drop policy if exists "Authenticated users can upload certificate files" on storage.objects;
create policy "Authenticated users can upload certificate files"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'certificate-files');

drop policy if exists "Authenticated users can update certificate files" on storage.objects;
create policy "Authenticated users can update certificate files"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'certificate-files')
  with check (bucket_id = 'certificate-files');
