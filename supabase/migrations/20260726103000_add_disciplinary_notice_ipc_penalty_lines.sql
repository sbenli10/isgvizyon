alter table public.disciplinary_notice_records
  add column if not exists ipc_penalty_lines jsonb not null default '[]'::jsonb;
