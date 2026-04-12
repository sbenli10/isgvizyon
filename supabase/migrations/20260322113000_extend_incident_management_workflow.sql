alter table public.incident_reports
  add column if not exists root_cause_category text
    check (
      root_cause_category in (
        'human_error',
        'unsafe_condition',
        'training_gap',
        'process_gap',
        'equipment_failure',
        'environmental_factor',
        'contractor_issue',
        'other'
      )
    ),
  add column if not exists closure_summary text,
  add column if not exists closure_decision text
    check (
      closure_decision in (
        'monitor_only',
        'training_action',
        'process_revision',
        'capa_required'
      )
    ),
  add column if not exists closure_notes text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null,
  add column if not exists capa_record_id uuid;

create index if not exists idx_incident_reports_status_closed_at
  on public.incident_reports(status, closed_at desc);

create index if not exists idx_incident_reports_root_cause_category
  on public.incident_reports(root_cause_category);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'incident_reports_capa_record_id_fkey'
  ) then
    alter table public.incident_reports
      add constraint incident_reports_capa_record_id_fkey
      foreign key (capa_record_id)
      references public.capa_records(id)
      on delete set null;
  end if;
end $$;
