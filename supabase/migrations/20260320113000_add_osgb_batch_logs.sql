create table if not exists public.osgb_batch_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  batch_type text not null,
  run_source text not null default 'cron',
  status text not null default 'success' check (status in ('success', 'error')),
  processed_count integer not null default 0,
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_osgb_batch_logs_created_at on public.osgb_batch_logs(created_at desc);
create index if not exists idx_osgb_batch_logs_batch_type on public.osgb_batch_logs(batch_type, created_at desc);

alter table public.osgb_batch_logs enable row level security;

drop policy if exists "Users can view own OSGB batch logs" on public.osgb_batch_logs;
create policy "Users can view own OSGB batch logs"
on public.osgb_batch_logs
for select
using (auth.uid() = user_id or user_id is null);
