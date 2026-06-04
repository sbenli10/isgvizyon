alter table public.saved_risk_items
  add column if not exists hazard text,
  add column if not exists risk text,
  add column if not exists current_status text,
  add column if not exists detection_date date,
  add column if not exists probability_before int,
  add column if not exists frequency_before int,
  add column if not exists severity_before int,
  add column if not exists risk_score_before int,
  add column if not exists risk_definition_before text,
  add column if not exists possible_consequence text,
  add column if not exists corrective_preventive_action text,
  add column if not exists probability_after int,
  add column if not exists frequency_after int,
  add column if not exists severity_after int,
  add column if not exists risk_score_after int,
  add column if not exists risk_definition_after text,
  add column if not exists deadline date,
  add column if not exists source text not null default 'manual',
  add column if not exists is_active boolean not null default true;

update public.saved_risk_items
set
  hazard = coalesce(hazard, hazard_source),
  risk = coalesce(risk, risk_description),
  current_status = coalesce(current_status, current_measures),
  probability_before = coalesce(probability_before, probability),
  severity_before = coalesce(severity_before, severity),
  risk_score_before = coalesce(risk_score_before, risk_score),
  risk_definition_before = coalesce(risk_definition_before, risk_description),
  corrective_preventive_action = coalesce(corrective_preventive_action, additional_measures),
  deadline = coalesce(deadline, due_date),
  source = coalesce(source, 'manual'),
  is_active = coalesce(is_active, true)
where hazard is null
   or risk is null
   or current_status is null
   or probability_before is null
   or severity_before is null
   or risk_score_before is null
   or risk_definition_before is null
   or corrective_preventive_action is null
   or deadline is null
   or source is null
   or is_active is null;

create index if not exists idx_saved_risk_items_user_active
  on public.saved_risk_items(user_id, is_active, created_at desc);

create index if not exists idx_saved_risk_items_organization
  on public.saved_risk_items(organization_id)
  where organization_id is not null;

create index if not exists idx_saved_risk_items_company
  on public.saved_risk_items(company_id)
  where company_id is not null;

create index if not exists idx_saved_risk_items_activity
  on public.saved_risk_items(activity);

create index if not exists idx_saved_risk_items_hazard
  on public.saved_risk_items(hazard);

create index if not exists idx_saved_risk_items_source
  on public.saved_risk_items(source, is_active);
