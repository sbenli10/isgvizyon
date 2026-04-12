create table if not exists public.health_surveillance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  exam_type text not null check (exam_type in ('pre_employment','periodic','return_to_work','special')),
  exam_date date not null,
  next_exam_date date null,
  physician_name text null,
  result_status text not null default 'pending' check (result_status in ('fit','conditional_fit','unfit','pending')),
  restrictions text null,
  summary text null,
  notes text null,
  status text not null default 'active' check (status in ('active','warning','overdue','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_surveillance_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.health_surveillance_records(id) on delete cascade,
  user_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_size bigint null,
  mime_type text null,
  report_date date not null default current_date,
  file_summary text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_health_surveillance_records_user_exam on public.health_surveillance_records(user_id, next_exam_date);
create index if not exists idx_health_surveillance_records_employee on public.health_surveillance_records(employee_id, exam_date desc);
create index if not exists idx_health_surveillance_files_record on public.health_surveillance_files(record_id, report_date desc);

alter table public.health_surveillance_records enable row level security;
alter table public.health_surveillance_files enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'health_surveillance_records' and policyname = 'Users manage own health surveillance records'
  ) then
    create policy "Users manage own health surveillance records"
      on public.health_surveillance_records
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'health_surveillance_files' and policyname = 'Users manage own health surveillance files'
  ) then
    create policy "Users manage own health surveillance files"
      on public.health_surveillance_files
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

insert into storage.buckets (id, name, public)
select 'health-surveillance-files', 'health-surveillance-files', false
where not exists (
  select 1 from storage.buckets where id = 'health-surveillance-files'
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Health surveillance files read own'
  ) then
    create policy "Health surveillance files read own"
      on storage.objects
      for select
      using (bucket_id = 'health-surveillance-files' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Health surveillance files upload own'
  ) then
    create policy "Health surveillance files upload own"
      on storage.objects
      for insert
      with check (bucket_id = 'health-surveillance-files' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Health surveillance files update own'
  ) then
    create policy "Health surveillance files update own"
      on storage.objects
      for update
      using (bucket_id = 'health-surveillance-files' and auth.uid()::text = (storage.foldername(name))[1])
      with check (bucket_id = 'health-surveillance-files' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Health surveillance files delete own'
  ) then
    create policy "Health surveillance files delete own"
      on storage.objects
      for delete
      using (bucket_id = 'health-surveillance-files' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'update_updated_at_column'
  ) then
    if not exists (select 1 from pg_trigger where tgname = 'trg_health_surveillance_records_updated_at') then
      create trigger trg_health_surveillance_records_updated_at
      before update on public.health_surveillance_records
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;
