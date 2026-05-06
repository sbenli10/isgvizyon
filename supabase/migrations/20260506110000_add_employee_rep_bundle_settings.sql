alter table if exists public.assignment_letter_settings
  add column if not exists employee_rep_revision_no text null,
  add column if not exists employee_rep_prepared_by_name text null,
  add column if not exists employee_rep_prepared_by_title text null,
  add column if not exists employee_rep_approved_by_name text null,
  add column if not exists employee_rep_approved_by_title text null,
  add column if not exists employee_rep_trainer_name text null,
  add column if not exists employee_rep_trainer_title text null;
