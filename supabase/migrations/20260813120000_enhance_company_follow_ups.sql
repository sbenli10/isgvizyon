alter table public.company_follow_ups
  add column if not exists priority text not null default 'normal',
  add column if not exists owner_name text,
  add column if not exists regulation_area text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists reminder_days_before integer not null default 7;

create index if not exists company_follow_ups_company_due_idx
  on public.company_follow_ups (company_id, due_date);

create index if not exists company_follow_ups_status_due_idx
  on public.company_follow_ups (status, due_date);

create index if not exists company_follow_ups_user_org_idx
  on public.company_follow_ups (user_id, organization_id);
