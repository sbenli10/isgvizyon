create table if not exists public.ai_function_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  function_name text not null,
  request_label text,
  status text not null check (status in ('success', 'error')),
  resolved_model text,
  attempted_models text[] not null default '{}',
  attempts_count integer not null default 0,
  duration_ms integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_ai_function_logs_created_at
  on public.ai_function_logs (created_at desc);

create index if not exists idx_ai_function_logs_function_created_at
  on public.ai_function_logs (function_name, created_at desc);

alter table public.ai_function_logs enable row level security;

drop policy if exists "Authenticated users can view ai function logs" on public.ai_function_logs;
create policy "Authenticated users can view ai function logs"
  on public.ai_function_logs
  for select
  to authenticated
  using (true);
