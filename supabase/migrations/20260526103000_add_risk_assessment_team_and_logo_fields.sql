alter table public.risk_assessments
  add column if not exists informed_employee_name text,
  add column if not exists risk_assessment_logo_name text,
  add column if not exists risk_assessment_logo_type text,
  add column if not exists risk_assessment_logo_data_url text;
