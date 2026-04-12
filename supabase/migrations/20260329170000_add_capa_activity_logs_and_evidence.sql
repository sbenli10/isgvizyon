create table if not exists public.capa_activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  capa_record_id uuid references public.capa_records(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete cascade,
  action_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint capa_activity_logs_target_check check (
    capa_record_id is not null or finding_id is not null
  )
);

create index if not exists idx_capa_activity_logs_user_created_at
  on public.capa_activity_logs(user_id, created_at desc);
create index if not exists idx_capa_activity_logs_capa_record
  on public.capa_activity_logs(capa_record_id, created_at desc);
create index if not exists idx_capa_activity_logs_finding
  on public.capa_activity_logs(finding_id, created_at desc);

alter table public.capa_activity_logs enable row level security;

drop policy if exists "Users can view own capa activity logs" on public.capa_activity_logs;
create policy "Users can view own capa activity logs"
  on public.capa_activity_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own capa activity logs" on public.capa_activity_logs;
create policy "Users can insert own capa activity logs"
  on public.capa_activity_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own capa activity logs" on public.capa_activity_logs;
create policy "Users can update own capa activity logs"
  on public.capa_activity_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own capa activity logs" on public.capa_activity_logs;
create policy "Users can delete own capa activity logs"
  on public.capa_activity_logs
  for delete
  using (auth.uid() = user_id);

alter table public.capa_records
  add column if not exists media_urls jsonb not null default '[]'::jsonb,
  add column if not exists document_urls jsonb not null default '[]'::jsonb,
  add column if not exists file_urls jsonb not null default '[]'::jsonb;
