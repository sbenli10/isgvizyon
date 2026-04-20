alter table public.employees
  add column if not exists full_name text,
  add column if not exists insured_job_code text,
  add column if not exists insured_job_name text;

update public.employees
set
  full_name = coalesce(nullif(full_name, ''), nullif(trim(concat_ws(' ', first_name, last_name)), '')),
  insured_job_name = coalesce(nullif(insured_job_name, ''), nullif(job_title, ''))
where
  full_name is null
  or full_name = ''
  or insured_job_name is null
  or insured_job_name = '';
