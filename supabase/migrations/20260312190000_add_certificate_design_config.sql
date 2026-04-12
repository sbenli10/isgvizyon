alter table public.certificates
  add column if not exists design_config jsonb not null default '{}'::jsonb;
