alter table if exists public.bulk_capa_sessions
  add column if not exists job_type text,
  add column if not exists processing_started_at timestamp with time zone,
  add column if not exists processing_completed_at timestamp with time zone,
  add column if not exists processing_error text,
  add column if not exists draft_payload jsonb not null default '{}'::jsonb,
  add column if not exists job_result_payload jsonb not null default '{}'::jsonb;

create index if not exists bulk_capa_sessions_user_status_updated_idx
  on public.bulk_capa_sessions (user_id, status, updated_at desc);

create index if not exists bulk_capa_sessions_user_job_updated_idx
  on public.bulk_capa_sessions (user_id, job_type, updated_at desc);
