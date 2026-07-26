alter table public.disciplinary_notice_records
  add column if not exists notice_type text not null default 'employee',
  add column if not exists ipc_employee_range text not null default '',
  add column if not exists ipc_rule_id text not null default '',
  add column if not exists ipc_rule_title text not null default '',
  add column if not exists ipc_rule_article text not null default '',
  add column if not exists ipc_base_amount numeric not null default 0,
  add column if not exists ipc_multiplier numeric not null default 1,
  add column if not exists ipc_penalty_amount numeric not null default 0,
  add column if not exists ipc_explanation text not null default '',
  add column if not exists ipc_request_note text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'disciplinary_notice_type_check'
      and conrelid = 'public.disciplinary_notice_records'::regclass
  ) then
    alter table public.disciplinary_notice_records
      add constraint disciplinary_notice_type_check check (notice_type in ('employee', 'employer'));
  end if;
end;
$$;

create index if not exists idx_disciplinary_notice_records_type
  on public.disciplinary_notice_records(notice_type, notice_date desc);
