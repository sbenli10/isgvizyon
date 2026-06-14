alter table public.companies
  add column if not exists emergency_team_info jsonb not null default '{}'::jsonb,
  add column if not exists document_tracking_info jsonb not null default '[]'::jsonb;
